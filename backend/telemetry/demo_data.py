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
    DriverMeta(abbreviation="STR", team_name="Aston Martin", team_color="#229971", driver_number="18"),
]

DEMO_TYRES = {
    "VER": "MEDIUM",
    "NOR": "MEDIUM",
    "LEC": "SOFT",
    "HAM": "MEDIUM",
    "PIA": "SOFT",
    "SAI": "HARD",
    "RUS": "SOFT",
    "PER": "MEDIUM",
    "ALO": "HARD",
    "STR": "MEDIUM",
}


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
    """Procedurally construct a complete, valid 5-lap ProcessedSession if the pickle is unavailable."""
    # Create smooth track coordinates (ellipse with variations)
    num_pts = 300
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

    total_laps = 5
    info = SessionInfo(
        year=2024,
        event="Demo Grand Prix",
        session_name="Demo Race (Sample Telemetry)",
        session_type="R",
        total_laps=total_laps,
        is_demo=True,
    )

    # 5 laps simulation including leader crossing finish line
    track_len = len(circuit_x)
    frames_per_lap = 70
    cooldown_frames = 8
    total_frames = frames_per_lap * total_laps + cooldown_frames
    frames: list[ReplayFrame] = []

    for step in range(total_frames):
        t = round(step * 0.5, 2)
        leader_lap = min(total_laps, 1 + (step // frames_per_lap))

        driver_states = []
        for rank, drv in enumerate(DEMO_DRIVERS):
            abbr = drv.abbreviation
            # Progress index along track
            prog = (step * 4 - rank * 8)
            curr_lap = max(1, min(total_laps, 1 + (prog // (track_len * 2))))
            idx = int(prog % track_len)
            x_pos = circuit_x[idx]
            y_pos = circuit_y[idx]

            speed = 260.0 + 40.0 * math.sin(step * 0.15 + rank * 0.5)
            gear = max(2, min(8, int(speed / 42.0)))
            throttle = 100.0 if speed > 250.0 else 50.0
            brake = speed < 240.0
            rpm = 9500.0 + 2000.0 * (speed / 320.0)

            # DRS flap open (12) in straight sections with high speed, 0 otherwise
            is_drs = (idx < track_len // 6 or idx > 5 * track_len // 6) and speed > 270.0
            drs_val = 12 if is_drs else 0

            sec = 1 if idx < track_len // 3 else (2 if idx < 2 * track_len // 3 else 3)

            driver_states.append({
                "drv": drv,
                "prog": prog,
                "x": float(x_pos),
                "y": float(y_pos),
                "speed": float(round(speed, 1)),
                "gear": gear,
                "throttle": float(round(throttle, 1)),
                "brake": brake,
                "rpm": float(round(rpm, 1)),
                "drs": drs_val,
                "tyre": DEMO_TYRES.get(abbr, "MEDIUM"),
                "lap": curr_lap,
                "sector": sec,
            })

        # Sort strictly by progress to determine rank
        driver_states.sort(key=lambda s: s["prog"], reverse=True)

        drivers_in_frame: list[DriverFrame] = []
        for pos_idx, s in enumerate(driver_states):
            drivers_in_frame.append(
                DriverFrame(
                    driver_id=s["drv"].abbreviation,
                    x=s["x"],
                    y=s["y"],
                    speed=s["speed"],
                    gear=s["gear"],
                    throttle=s["throttle"],
                    brake=s["brake"],
                    rpm=s["rpm"],
                    drs=s["drs"],
                    tyre=s["tyre"],
                    lap=s["lap"],
                    sector=s["sector"],
                    position=pos_idx + 1,  # Strictly 1..10
                )
            )

        frames.append(ReplayFrame(timestamp=t, lap=leader_lap, drivers=drivers_in_frame))

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
