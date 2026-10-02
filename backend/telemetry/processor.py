"""Converts raw per-driver telemetry into synchronized ReplayFrames on a shared time grid."""
from __future__ import annotations

import bisect
import logging

import pandas as pd

from telemetry.models import DriverFrame, ReplayData, ReplayFrame

logger = logging.getLogger(__name__)

# Backend emits frames at a fixed, coarse interval; the PixiJS frontend lerps
# between them for a smooth 60 FPS feel while keeping payload size sane.
FRAME_INTERVAL_S = 0.5


def _interpolate_row(tel: pd.DataFrame, t: float) -> dict | None:
    """Linearly interpolate numeric columns, hold discrete columns from the left sample."""
    times = tel["t"].values
    if len(times) == 0 or t < times[0] or t > times[-1]:
        return None
    i = bisect.bisect_left(times, t)
    i = max(1, min(i, len(times) - 1))
    t0, t1 = times[i - 1], times[i]
    frac = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
    row0, row1 = tel.iloc[i - 1], tel.iloc[i]

    def lerp(col: str, default: float = 0.0) -> float:
        a, b = row0.get(col, default), row1.get(col, default)
        return a + (b - a) * frac

    return {
        "x": lerp("X"), "y": lerp("Y"), "speed": lerp("Speed"),
        "gear": int(row0.get("nGear", 0)), "throttle": lerp("Throttle"),
        "brake": bool(row0.get("Brake", False)), "rpm": lerp("RPM"),
        "drs": int(row0.get("DRS", 0)), "tyre": row0.get("Compound", "UNKNOWN"),
        "lap": int(row0.get("LapNumber", 1)), "sector": int(row0.get("Sector", 1)),
        "distance": lerp("Distance"),
    }


def build_replay_frames(raw_telemetry: dict[str, pd.DataFrame]) -> ReplayData:
    """Build a list of ReplayFrame, one per FRAME_INTERVAL_S tick, covering the full race."""
    if not raw_telemetry:
        return ReplayData(frames=[], min_time=0.0, max_time=0.0)

    min_t = min(df["t"].iloc[0] for df in raw_telemetry.values() if not df.empty)
    max_t = max(df["t"].iloc[-1] for df in raw_telemetry.values() if not df.empty)

    frames: list[ReplayFrame] = []
    t = min_t
    while t <= max_t:
        interpolated: dict[str, dict] = {}
        for abbr, tel in raw_telemetry.items():
            row = _interpolate_row(tel, t)
            if row is not None:
                interpolated[abbr] = row

        if interpolated:
            # Leaderboard position: rank by (lap, distance) descending.
            ranking = sorted(interpolated.items(), key=lambda kv: (kv[1]["lap"], kv[1]["distance"]), reverse=True)
            positions = {abbr: pos + 1 for pos, (abbr, _) in enumerate(ranking)}

            driver_frames = [
                DriverFrame(
                    driver_id=abbr, x=row["x"], y=row["y"], speed=row["speed"],
                    gear=row["gear"], throttle=row["throttle"], brake=row["brake"],
                    rpm=row["rpm"], drs=row["drs"], tyre=row["tyre"], lap=row["lap"],
                    sector=row["sector"], position=positions[abbr],
                )
                for abbr, row in interpolated.items()
            ]
            overall_lap = max(f.lap for f in driver_frames)
            frames.append(ReplayFrame(timestamp=round(t - min_t, 2), lap=overall_lap, drivers=driver_frames))

        t += FRAME_INTERVAL_S

    logger.info("Built %d synchronized replay frames (%.1fs interval)", len(frames), FRAME_INTERVAL_S)
    return ReplayData(frames=frames, min_time=0.0, max_time=round(max_t - min_t, 2))
