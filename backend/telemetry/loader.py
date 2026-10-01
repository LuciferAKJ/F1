"""Loads raw per-driver telemetry (X, Y, speed, gear, throttle, brake, RPM, DRS,
tyre compound, lap number, sector) for an entire race from a loaded FastF1 session.
"""
from __future__ import annotations
import logging
import pandas as pd

logger = logging.getLogger(__name__)

TELEMETRY_COLUMNS = ["X", "Y", "Speed", "nGear", "Throttle", "Brake", "RPM", "DRS"]


def _sector_for_row(lap_relative_s: float, s1: float | None, s2: float | None) -> int:
    """Determine sector (1/2/3) from lap-relative elapsed seconds and cumulative sector times."""
    if s1 is not None and lap_relative_s <= s1:
        return 1
    if s2 is not None and lap_relative_s <= s2:
        return 2
    return 3


def load_driver_raw_telemetry(session, drivers: list[str]) -> dict[str, pd.DataFrame]:
    """Return {abbr: DataFrame} with one row per telemetry sample across the whole race,
    tagged with LapNumber, Compound and Sector, and a normalized `t` (seconds from session start).
    """
    result: dict[str, pd.DataFrame] = {}

    for abbr in drivers:
        try:
            driver_laps = session.laps.pick_drivers(abbr)
            if driver_laps.empty:
                continue

            lap_frames: list[pd.DataFrame] = []
            for _, lap in driver_laps.iterlaps():
                try:
                    tel = lap.get_telemetry().add_distance()
                except Exception:  # noqa: BLE001
                    tel = lap.get_telemetry()
                    tel["Distance"] = 0.0
                if tel.empty:
                    continue

                cols = [c for c in TELEMETRY_COLUMNS if c in tel.columns]
                tel = tel[cols + ["Distance", "SessionTime"]].copy()
                tel["LapNumber"] = int(lap["LapNumber"])
                tel["Compound"] = lap.get("Compound", "UNKNOWN") or "UNKNOWN"

                lap_start = lap["LapStartTime"].total_seconds() if pd.notna(lap.get("LapStartTime")) else None
                s1 = lap["Sector1Time"].total_seconds() if pd.notna(lap.get("Sector1Time")) else None
                s2_raw = lap.get("Sector2Time")
                s2 = (s1 + s2_raw.total_seconds()) if (s1 is not None and pd.notna(s2_raw)) else None

                session_secs = tel["SessionTime"].dt.total_seconds()
                lap_relative = session_secs - (lap_start if lap_start is not None else session_secs.iloc[0])
                tel["Sector"] = lap_relative.apply(lambda v: _sector_for_row(v, s1, s2))
                tel["t"] = session_secs

                lap_frames.append(tel)

            if not lap_frames:
                continue

            full = pd.concat(lap_frames, ignore_index=True)
            full = full.dropna(subset=["X", "Y", "t"]).sort_values("t").reset_index(drop=True)
            result[abbr] = full
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load raw telemetry for %s: %s", abbr, exc)

    return result
