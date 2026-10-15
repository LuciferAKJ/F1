"""Shared test fixtures for the F1 Race Replay backend test suite."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from models.schemas import CircuitData, DriverMeta, SessionInfo
from telemetry.models import DriverFrame, ProcessedSession, ReplayData, ReplayFrame


@pytest.fixture()
def app_client():
    """A FastAPI TestClient for integration testing API routes.

    Individual tests should mock the heavy services (fastf1_service, telemetry pipeline)
    to avoid downloading real session data.
    """
    from main import app
    return TestClient(app)


@pytest.fixture()
def sample_driver_frame() -> DriverFrame:
    """A minimal valid DriverFrame for unit tests."""
    return DriverFrame(
        driver_id="VER",
        x=100.0, y=200.0,
        speed=300.0, gear=7, throttle=100.0,
        brake=False, rpm=11000.0, drs=0,
        tyre="MEDIUM", lap=5, sector=2,
        position=1,
    )


@pytest.fixture()
def sample_replay_frames() -> list[ReplayFrame]:
    """A small sequence of ReplayFrames for testing query/filter logic."""
    def make_frame(ts: float, lap: int, drivers: list[DriverFrame]) -> ReplayFrame:
        return ReplayFrame(timestamp=ts, lap=lap, drivers=drivers)

    def ver(ts: float, lap: int, pos: int) -> DriverFrame:
        return DriverFrame(
            driver_id="VER", x=100+ts, y=200+ts,
            speed=300.0, gear=7, throttle=100.0,
            brake=False, rpm=11000.0, drs=0,
            tyre="MEDIUM", lap=lap, sector=1, position=pos,
        )

    def ham(ts: float, lap: int, pos: int) -> DriverFrame:
        return DriverFrame(
            driver_id="HAM", x=90+ts, y=190+ts,
            speed=295.0, gear=7, throttle=98.0,
            brake=False, rpm=10800.0, drs=0,
            tyre="HARD", lap=lap, sector=1, position=pos,
        )

    return [
        make_frame(0.0, 1, [ver(0.0, 1, 1), ham(0.0, 1, 2)]),
        make_frame(0.5, 1, [ver(0.5, 1, 1), ham(0.5, 1, 2)]),
        make_frame(1.0, 1, [ver(1.0, 1, 1), ham(1.0, 1, 2)]),
        make_frame(1.5, 2, [ver(1.5, 2, 1), ham(1.5, 2, 2)]),
        make_frame(2.0, 2, [ver(2.0, 2, 2), ham(2.0, 2, 1)]),  # position swap
        make_frame(2.5, 2, [ver(2.5, 2, 2), ham(2.5, 2, 1)]),
        make_frame(3.0, 3, [ver(3.0, 3, 1), ham(3.0, 3, 2)]),  # swap back
    ]


@pytest.fixture()
def sample_replay_data(sample_replay_frames) -> ReplayData:
    """A ReplayData wrapping sample_replay_frames."""
    return ReplayData(
        frames=sample_replay_frames,
        min_time=0.0,
        max_time=3.0,
    )


@pytest.fixture()
def sample_processed_session(sample_replay_data: ReplayData) -> ProcessedSession:
    """A full ProcessedSession fixture for API integration tests."""
    info = SessionInfo(
        year=2024,
        event="Bahrain",
        session_name="Race",
        session_type="R",
        total_laps=57,
    )
    drivers = [
        DriverMeta(
            abbreviation="VER",
            team_name="Red Bull Racing",
            team_color="#3671C6",
            driver_number="1",
        ),
        DriverMeta(
            abbreviation="HAM",
            team_name="Mercedes",
            team_color="#00D2BE",
            driver_number="44",
        ),
    ]
    circuit = CircuitData(
        x=[0.0, 10.0, 20.0],
        y=[0.0, 15.0, 30.0],
        min_x=0.0,
        max_x=20.0,
        min_y=0.0,
        max_y=30.0,
    )
    return ProcessedSession(
        info=info,
        drivers=drivers,
        circuit=circuit,
        replay_data=sample_replay_data,
    )
