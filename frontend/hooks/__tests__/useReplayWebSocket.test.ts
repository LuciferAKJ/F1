import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useReplayWebSocket,
  MAX_RECONNECT_ATTEMPTS,
  BASE_RECONNECT_DELAY_MS,
  STABLE_CONNECTION_DELAY_MS,
} from "../useReplayWebSocket";
import { useReplayStore } from "@/store/replayStore";
import type { SelectedRace } from "@/store/replayStore";

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateClose(wasClean: boolean = true, code: number = 1000) {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      const closeEvent = {
        wasClean,
        code,
        reason: "",
      } as CloseEvent;
      this.onclose(closeEvent);
    }
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
  }
}

describe("useReplayWebSocket", () => {
  const originalWebSocket = global.WebSocket;
  const mockRace: SelectedRace = { year: 2024, event: "Bahrain", sessionType: "R" };

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

    // Reset Zustand replay store to known test state
    useReplayStore.setState({
      playing: false,
      playbackSpeed: 1,
      currentTimestamp: 0,
      frames: [],
      currentFrame: null,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    (global as unknown as { WebSocket: typeof originalWebSocket }).WebSocket = originalWebSocket;
  });

  it("connects to the correct WebSocket endpoint on mount", () => {
    renderHook(() => useReplayWebSocket(mockRace));

    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toContain("/ws/replay/2024/Bahrain/R");
  });

  it("synchronizes latest playback state upon connection open", () => {
    // Pre-populate store with non-default state
    useReplayStore.setState({
      playing: true,
      playbackSpeed: 2,
      currentTimestamp: 42.5,
    });

    renderHook(() => useReplayWebSocket(mockRace));
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.simulateOpen();
    });

    const sent = socket.sentMessages.map((m) => JSON.parse(m));
    expect(sent).toContainEqual({ action: "play" });
    expect(sent).toContainEqual({ action: "speed", value: 2 });
    expect(sent).toContainEqual({ action: "seek", time: 42.5 });
  });

  it("synchronizes updated playback state across reconnects without stale closures", () => {
    const { unmount } = renderHook(() => useReplayWebSocket(mockRace));
    const firstSocket = MockWebSocket.instances[0];

    // Initial connection at time 0
    act(() => {
      firstSocket.simulateOpen();
    });

    // Simulate replay progress and state change in store after mount
    act(() => {
      useReplayStore.setState({
        playing: true,
        playbackSpeed: 4,
        currentTimestamp: 125.75,
      });
    });

    // Abnormal disconnect
    act(() => {
      firstSocket.simulateClose(false, 1006);
    });

    // Advance timer by base reconnect delay
    act(() => {
      vi.advanceTimersByTime(BASE_RECONNECT_DELAY_MS);
    });

    expect(MockWebSocket.instances.length).toBe(2);
    const secondSocket = MockWebSocket.instances[1];

    // Connect second socket
    act(() => {
      secondSocket.simulateOpen();
    });

    const sent = secondSocket.sentMessages.map((m) => JSON.parse(m));
    // Must synchronize the updated values (speed 4, time 125.75, playing true), NOT stale initial mount values
    expect(sent).toContainEqual({ action: "play" });
    expect(sent).toContainEqual({ action: "speed", value: 4 });
    expect(sent).toContainEqual({ action: "seek", time: 125.75 });

    unmount();
  });

  it("bounds reconnection attempts and does NOT retry forever on rapid connect/drop chattering", () => {
    renderHook(() => useReplayWebSocket(mockRace));

    // Attempt 1: connect and immediately disconnect abnormally before stability threshold
    const s1 = MockWebSocket.instances[0];
    act(() => {
      s1.simulateOpen();
      s1.simulateClose(false, 1006);
    });

    // Advance time for first retry
    act(() => {
      vi.advanceTimersByTime(BASE_RECONNECT_DELAY_MS);
    });
    expect(MockWebSocket.instances.length).toBe(2);

    // Attempt 2: connect and immediately disconnect abnormally
    const s2 = MockWebSocket.instances[1];
    act(() => {
      s2.simulateOpen();
      s2.simulateClose(false, 1006);
    });

    // Advance time for second retry
    act(() => {
      vi.advanceTimersByTime(BASE_RECONNECT_DELAY_MS * 1.5);
    });
    expect(MockWebSocket.instances.length).toBe(3);

    // Attempt 3: connect and immediately disconnect abnormally
    const s3 = MockWebSocket.instances[2];
    act(() => {
      s3.simulateOpen();
      s3.simulateClose(false, 1006);
    });

    // Advance time for third retry
    act(() => {
      vi.advanceTimersByTime(BASE_RECONNECT_DELAY_MS * 1.5 * 1.5);
    });
    expect(MockWebSocket.instances.length).toBe(4);

    // Attempt 4: connects and disconnects abnormally -> MAX_RECONNECT_ATTEMPTS reached
    const s4 = MockWebSocket.instances[3];
    act(() => {
      s4.simulateOpen();
      s4.simulateClose(false, 1006);
    });

    // Advance time further -> NO more sockets should be spawned
    act(() => {
      vi.advanceTimersByTime(100000);
    });
    expect(MockWebSocket.instances.length).toBe(4);
  });

  it("resets consecutive retry count only after connection has remained stable for STABLE_CONNECTION_DELAY_MS", () => {
    renderHook(() => useReplayWebSocket(mockRace));

    // First attempt fails quickly
    const s1 = MockWebSocket.instances[0];
    act(() => {
      s1.simulateOpen();
      s1.simulateClose(false, 1006);
    });

    act(() => {
      vi.advanceTimersByTime(BASE_RECONNECT_DELAY_MS);
    });
    expect(MockWebSocket.instances.length).toBe(2);

    // Second connection opens and remains healthy for full stability window
    const s2 = MockWebSocket.instances[1];
    act(() => {
      s2.simulateOpen();
    });

    // Advance past stability threshold
    act(() => {
      vi.advanceTimersByTime(STABLE_CONNECTION_DELAY_MS + 100);
    });

    // Connection now disconnects abnormally later in session
    act(() => {
      s2.simulateClose(false, 1006);
    });

    // Because it was stable, retries are allowed again
    act(() => {
      vi.advanceTimersByTime(BASE_RECONNECT_DELAY_MS);
    });
    expect(MockWebSocket.instances.length).toBe(3);
  });

  it("does not attempt reconnect on clean closure", () => {
    renderHook(() => useReplayWebSocket(mockRace));
    const s1 = MockWebSocket.instances[0];

    act(() => {
      s1.simulateOpen();
      s1.simulateClose(true, 1000); // Clean close
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(MockWebSocket.instances.length).toBe(1);
  });
});

