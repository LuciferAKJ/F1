"""Preloaded demo replay dataset and detection helpers.

Allows users and evaluators to experience the full interactive F1 track replay
platform without requiring live unauthenticated F1 telemetry access.
"""
from __future__ import annotations

import logging
import math
import os
import pickle

from models.schemas import CircuitData, DriverMeta, SessionInfo
from telemetry.models import DriverFrame, ProcessedSession, ReplayData, ReplayFrame

logger = logging.getLogger(__name__)

_cached_demo_session: ProcessedSession | None = None

DEMO_DRIVERS = [
    DriverMeta(abbreviation="VER", team_name="Red Bull Racing", team_color="#3671C6", driver_number="1"),
    DriverMeta(abbreviation="NOR", team_name="McLaren", team_color="#FF8000", driver_number="4"),
    DriverMeta(abbreviation="LEC", team_name="Ferrari", team_color="#E80020", driver_number="16"),
    DriverMeta(abbreviation="HAM", team_name="Mercedes", team_color="#27F4D2", driver_number="44"),
    DriverMeta(abbreviation="PIA", team_name="McLaren", team_color="#FF8000", driver_number="81"),
    DriverMeta(abbreviation="SAI", team_name="Ferrari", team_color="#E80020", driver_number="55"),
    DriverMeta(abbreviation="RUS", team_name="Mercedes", team_color="#27F4D2", driver_number="63"),
    DriverMeta(abbreviation="PER", team_name="Red Bull Racing", team_color="#3671C6", driver_number="11"),
    DriverMeta(abbreviation="ALO", team_name="Aston Martin", team_color="#229971", driver_number="14"),
    DriverMeta(abbreviation="TSU", team_name="RB", team_color="#6692FF", driver_number="22"),
]


def is_demo_session(year: int | str, event: str, session_type: str = "R") -> bool:
    """Check whether a given request targets the offline demo session."""
    try:
        if int(year) == 0:
            return True
    except (ValueError, TypeError):
        pass

    ev = event.strip().lower().replace("_", " ")
    return ev in ("demo", "demo grand prix", "demograndprix")


def _build_synthetic_demo_session() -> ProcessedSession:
    """Procedurally construct a complete, valid ProcessedSession if the pickle is unavailable."""
    # Create smooth track coordinates (ellipse with variations)
    num_pts = 200
    circuit_x: list[float] = []
    circuit_y: list[float] = []
    for i in range(num_pts):
        angle = 2.0 * math.pi * i / num_pts
        r = 3000.0 + 800.0 * math.sin(3.0 * angle) + 400.0 * math.cos(5.0 * angle)
        circuit_x.append(round(r * math.cos(angle) + 2000.0, 2))
        circuit_y.append(round(r * math.sin(angle) + 2000.0, 2))

    circuit = CircuitData(
        x=circuit_x,
        y=circuit_y,
        min_x=min(circuit_x),
        max_x=max(circuit_x),
        min_y=min(circuit_y),
        max_y=max(circuit_y),
    )

    info = SessionInfo(
        year=2024,
        event="Demo Grand Prix",
        session_name="Demo Race (Sample Telemetry)",
        session_type="R",
        total_laps=5,
        is_demo=True,
    )

    # 120 frames at 0.5s intervals (60s duration)
    frames: list[ReplayFrame] = []
    track_len = len(circuit_x)

    for step in range(120):
        t = round(step * 0.5, 2)
        lap = 1 + (step // 60)
        drivers_in_frame: list[DriverFrame] = []

        for rank, drv in enumerate(DEMO_DRIVERS):
            offset_idx = int((step * 2 - rank * 4) % track_len)
            x_pos = circuit_x[offset_idx]
            y_pos = circuit_y[offset_idx]
            speed = 280.0 + 30.0 * math.sin(step * 0.2 + rank)
            gear = max(3, min(8, int(speed / 45.0)))
            throttle = 100.0 if speed > 260.0 else 60.0
            brake = speed < 240.0
            rpm = 10500.0 + 1500.0 * (throttle / 100.0)
            sector = 1 if offset_idx < track_len // 3 else (2 if offset_idx < 2 * track_len // 3 else 3)

            drivers_in_frame.append(
                DriverFrame(
                    driver_id=drv.abbreviation,
                    x=float(x_pos),
                    y=float(y_pos),
                    speed=float(speed),
                    gear=gear,
                    throttle=float(throttle),
                    brake=brake,
                    rpm=float(rpm),
                    drs=1 if rank > 0 and speed > 280.0 else 0,
                    tyre="MEDIUM",
                    lap=lap,
                    sector=sector,
                    position=rank + 1,
                )
            )

        frames.append(ReplayFrame(timestamp=t, lap=lap, drivers=drivers_in_frame))

    replay_data = ReplayData(
        frames=frames,
        min_time=0.0,
        max_time=round(frames[-1].timestamp, 2),
    )

    return ProcessedSession(
        info=info,
        drivers=DEMO_DRIVERS,
        circuit=circuit,
        replay_data=replay_data,
    )


def get_demo_session() -> ProcessedSession:
    """Return the cached demo ProcessedSession, loading from disk asset if present."""
    global _cached_demo_session
    if _cached_demo_session is not None:
        return _cached_demo_session

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pickle_path = os.path.join(base_dir, "assets", "demo", "demo_replay.pkl")

    if os.path.exists(pickle_path):
        try:
            with open(pickle_path, "rb") as f:
                data = pickle.load(f)
            if isinstance(data, ProcessedSession) and data.circuit.x and data.replay_data.frames:
                data.info.is_demo = True
                _cached_demo_session = data
                logger.info("Loaded pre-packaged demo replay from %s (%d frames)", pickle_path, len(data.replay_data.frames))
                return _cached_demo_session
        except Exception as exc:
            logger.warning("Failed to load pre-packaged demo replay %s: %s; falling back to procedural generation", pickle_path, exc)

    logger.info("Generating procedural demo replay session")
    _cached_demo_session = _build_synthetic_demo_session()
    return _cached_demo_session
