import { create } from "zustand";
import type { ReplayMetadataDTO } from "@/types/api";
import type { RawReplayFrame } from "@/lib/replayAdapter";

export interface SelectedRace {
  year: number;
  event: string;
  sessionType: string;
}

interface PixiControls {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  followDriver: (abbr: string) => void;
  stopFollowing: () => void;
}

interface WsControls {
  seek: (timestamp: number) => void;
}

interface ReplayState {
  selectedRace: SelectedRace | null;
  metadata: ReplayMetadataDTO | null;
  frames: RawReplayFrame[]; // frames received so far (streamed or bulk-loaded)
  currentFrame: RawReplayFrame | null;
  currentTimestamp: number;
  currentLap: number;
  playbackSpeed: number;
  playing: boolean;
  selectedDriver: string | null;
  pixiControls: PixiControls | null;
  wsControls: WsControls | null;

  setSelectedRace: (race: SelectedRace | null) => void;
  setMetadata: (metadata: ReplayMetadataDTO | null) => void;
  setFrames: (frames: RawReplayFrame[]) => void;
  pushFrame: (frame: RawReplayFrame) => void;
  setCurrentFrame: (frame: RawReplayFrame | null) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  seek: (timestamp: number) => void;
  setSelectedDriver: (abbr: string | null) => void;
  setPixiControls: (controls: PixiControls | null) => void;
  setWsControls: (controls: WsControls | null) => void;
  reset: () => void;
}

const initialState = {
  selectedRace: null,
  metadata: null,
  frames: [] as RawReplayFrame[],
  currentFrame: null,
  currentTimestamp: 0,
  currentLap: 1,
  playbackSpeed: 1,
  playing: false,
  selectedDriver: null,
  pixiControls: null,
  wsControls: null,
};

export const useReplayStore = create<ReplayState>((set) => ({
  ...initialState,

  setSelectedRace: (race) =>
    set((state) => ({ ...initialState, pixiControls: state.pixiControls, wsControls: state.wsControls, selectedRace: race })),
  setMetadata: (metadata) => set({ metadata }),
  setFrames: (frames) => set({ frames }),
  pushFrame: (frame) =>
    set((state) => ({
      frames: [...state.frames, frame],
      currentFrame: frame,
      currentTimestamp: frame.timestamp,
      currentLap: frame.lap,
    })),
  setCurrentFrame: (frame) =>
    set(
      frame
        ? { currentFrame: frame, currentTimestamp: frame.timestamp, currentLap: frame.lap }
        : { currentFrame: null }
    ),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  setSpeed: (speed) => set({ playbackSpeed: speed }),
  seek: (timestamp) => set({ currentTimestamp: timestamp }),
  setSelectedDriver: (abbr) => set({ selectedDriver: abbr }),
  setPixiControls: (controls) => set({ pixiControls: controls }),
  setWsControls: (controls) => set({ wsControls: controls }),
  reset: () => set((state) => ({ ...initialState, pixiControls: state.pixiControls, wsControls: state.wsControls })),
}));
