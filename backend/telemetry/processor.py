"""Converts raw per-driver telemetry into synchronized ReplayFrames on a shared time grid."""
from __future__ import annotations

import bisect
import logging

import numpy as np
import pandas as pd

from telemetry.models import DriverFrame, ReplayData, ReplayFrame

logger = logging.getLogger(__name__)

# Backend emits frames at a fixed, coarse interval; the PixiJS frontend lerps
# between them for a smooth 60 FPS feel while keeping payload size sane.
FRAME_INTERVAL_S = 0.5


class _DriverArrays:
    __slots__ = (
        "brake",
        "distance",
        "drs",
        "gear",
        "lap",
        "rpm",
        "sector",
        "speed",
        "t",
        "throttle",
        "tyre",
        "x",
        "y"
    )

    def __init__(self, tel: pd.DataFrame):
        self.t = tel["t"].to_numpy(dtype=np.float64)
        n = len(self.t)
        self.x = tel["X"].to_numpy(dtype=np.float32) if "X" in tel else np.zeros(n, dtype=np.float32)
        self.y = tel["Y"].to_numpy(dtype=np.float32) if "Y" in tel else np.zeros(n, dtype=np.float32)
        self.speed = tel["Speed"].to_numpy(dtype=np.float32) if "Speed" in tel else np.zeros(n, dtype=np.float32)
        self.gear = tel["nGear"].to_numpy(dtype=np.int16) if "nGear" in tel else np.zeros(n, dtype=np.int16)
        self.throttle = tel["Throttle"].to_numpy(dtype=np.float32) if "Throttle" in tel else np.zeros(n, dtype=np.float32)
        self.brake = tel["Brake"].to_numpy(dtype=bool) if "Brake" in tel else np.zeros(n, dtype=bool)
        self.rpm = tel["RPM"].to_numpy(dtype=np.float32) if "RPM" in tel else np.zeros(n, dtype=np.float32)
        self.drs = tel["DRS"].to_numpy(dtype=np.int16) if "DRS" in tel else np.zeros(n, dtype=np.int16)
        self.tyre = tel["Compound"].tolist() if "Compound" in tel else ["UNKNOWN"] * n
        self.lap = tel["LapNumber"].to_numpy(dtype=np.int16) if "LapNumber" in tel else np.ones(n, dtype=np.int16)
        self.sector = tel["Sector"].to_numpy(dtype=np.int8) if "Sector" in tel else np.ones(n, dtype=np.int8)
        self.distance = tel["Distance"].to_numpy(dtype=np.float32) if "Distance" in tel else np.zeros(n, dtype=np.float32)

    def interpolate(self, t: float) -> dict | None:
        times = self.t
        if len(times) == 0 or t < times[0] or t > times[-1]:
            return None
        i = bisect.bisect_left(times, t)
        i = max(1, min(i, len(times) - 1))
        t0, t1 = times[i - 1], times[i]
        frac = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)

        return {
            "x": float(self.x[i - 1] + (self.x[i] - self.x[i - 1]) * frac),
            "y": float(self.y[i - 1] + (self.y[i] - self.y[i - 1]) * frac),
            "speed": float(self.speed[i - 1] + (self.speed[i] - self.speed[i - 1]) * frac),
            "gear": int(self.gear[i - 1]),
            "throttle": float(self.throttle[i - 1] + (self.throttle[i] - self.throttle[i - 1]) * frac),
            "brake": bool(self.brake[i - 1]),
            "rpm": float(self.rpm[i - 1] + (self.rpm[i] - self.rpm[i - 1]) * frac),
            "drs": int(self.drs[i - 1]),
            "tyre": self.tyre[i - 1],
            "lap": int(self.lap[i - 1]),
            "sector": int(self.sector[i - 1]),
            "distance": float(self.distance[i - 1] + (self.distance[i] - self.distance[i - 1]) * frac),
        }


def _interpolate_row(tel: pd.DataFrame, t: float) -> dict | None:
    """Linearly interpolate numeric columns, hold discrete columns from the left sample."""
    return _DriverArrays(tel).interpolate(t)


def build_replay_frames(raw_telemetry: dict[str, pd.DataFrame]) -> ReplayData:
    """Build a list of ReplayFrame, one per FRAME_INTERVAL_S tick, covering the full race."""
    if not raw_telemetry:
        return ReplayData(frames=[], min_time=0.0, max_time=0.0)

    driver_arrays = {abbr: _DriverArrays(df) for abbr, df in raw_telemetry.items() if not df.empty}
    if not driver_arrays:
        return ReplayData(frames=[], min_time=0.0, max_time=0.0)

    min_t = min(arr.t[0] for arr in driver_arrays.values() if len(arr.t) > 0)
    max_t = max(arr.t[-1] for arr in driver_arrays.values() if len(arr.t) > 0)

    frames: list[ReplayFrame] = []
    t = min_t
    while t <= max_t:
        interpolated: dict[str, dict] = {}
        for abbr, arr in driver_arrays.items():
            row = arr.interpolate(t)
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
