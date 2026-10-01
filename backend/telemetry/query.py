"""Filtering and lookup helpers over a list of ReplayFrame."""
from __future__ import annotations
import bisect
from telemetry.models import ReplayFrame


def filter_frames(
    frames: list[ReplayFrame],
    start_time: float | None = None,
    end_time: float | None = None,
    lap: int | None = None,
    driver: str | None = None,
) -> list[ReplayFrame]:
    """Return a filtered slice of frames. `lap` takes precedence and overrides start/end time
    with that lap's own time bounds. `driver` restricts each frame's driver list to that driver only.
    """
    result = frames

    if lap is not None:
        lap_frames = [f for f in result if f.lap == lap]
        result = lap_frames if lap_frames else result

    if start_time is not None or end_time is not None:
        lo = start_time if start_time is not None else result[0].timestamp if result else 0.0
        hi = end_time if end_time is not None else result[-1].timestamp if result else 0.0
        result = [f for f in result if lo <= f.timestamp <= hi]

    if driver is not None:
        filtered: list[ReplayFrame] = []
        for f in result:
            drivers = [d for d in f.drivers if d.driver_id == driver]
            if drivers:
                filtered.append(ReplayFrame(timestamp=f.timestamp, lap=f.lap, drivers=drivers))
        result = filtered

    return result


def frame_at_timestamp(frames: list[ReplayFrame], timestamp: float) -> ReplayFrame | None:
    """Nearest frame to the given race-time timestamp (seconds from race start)."""
    if not frames:
        return None
    times = [f.timestamp for f in frames]
    i = bisect.bisect_left(times, timestamp)
    if i <= 0:
        return frames[0]
    if i >= len(frames):
        return frames[-1]
    before, after = frames[i - 1], frames[i]
    return before if (timestamp - before.timestamp) <= (after.timestamp - timestamp) else after
