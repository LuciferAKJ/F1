"""Tests for data availability, authentication failure handling, demo fallback,
and cache safety under missing/incomplete telemetry.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from services import fastf1_service
from services.session_overview_service import build_session_overview
from telemetry import pipeline
from telemetry.demo_data import (
    _build_synthetic_demo_session,
    get_demo_session,
    is_demo_session,
)
from telemetry.exceptions import TelemetryDataUnavailableError
from telemetry.models import ProcessedSession


@pytest.fixture(autouse=True)
def clean_pipeline_state():
    """Ensure in-memory cache and single-flight tracking are clean between tests."""
    with pipeline._memory_cache_lock:
        pipeline._memory_cache.clear()
    pipeline._inflight_futures.clear()
    yield
    with pipeline._memory_cache_lock:
        pipeline._memory_cache.clear()
    pipeline._inflight_futures.clear()


def test_demo_detection():
    """Verifies is_demo_session correctly identifies demo aliases and requests."""
    assert is_demo_session(0, "Demo Grand Prix", "R") is True
    assert is_demo_session("0", "Demo Grand Prix", "R") is True
    assert is_demo_session(2024, "demo", "R") is True
    assert is_demo_session(2026, "demo_grand_prix", "R") is True
    assert is_demo_session(2024, "Bahrain Grand Prix", "R") is False
    assert is_demo_session(2026, "Singapore Grand Prix", "R") is False


def test_demo_session_structure():
    """Verifies that the demo session dataset is self-contained, valid, and labelled as demo."""
    demo = get_demo_session()
    assert isinstance(demo, ProcessedSession)
    assert demo.info.is_demo is True
    assert demo.info.event == "Demo Grand Prix"
    assert len(demo.drivers) >= 10
    assert len(demo.circuit.x) > 0
    assert len(demo.circuit.y) == len(demo.circuit.x)
    assert len(demo.replay_data.frames) >= 120
    assert demo.replay_data.max_time == round(demo.replay_data.frames[-1].timestamp, 2)
    assert demo.info.total_laps == 5

    # Check lap and sector progression
    laps_observed = set(f.lap for f in demo.replay_data.frames)
    assert laps_observed == {1, 2, 3, 4, 5}

    sectors_observed = set(d.sector for f in demo.replay_data.frames for d in f.drivers)
    assert sectors_observed == {1, 2, 3}

    # Verify positions: strictly 1..10 in every frame with no duplicates
    for frame in demo.replay_data.frames:
        positions = [d.position for d in frame.drivers]
        assert sorted(positions) == list(range(1, len(demo.drivers) + 1))

    # DRS codes are authentic (0 closed, 10/12/14 open)
    drs_codes = set(d.drs for f in demo.replay_data.frames for d in f.drivers)
    assert drs_codes.issubset({0, 10, 12, 14})
    assert 12 in drs_codes

    # Tyres have compound variety
    tyres_observed = set(d.tyre for f in demo.replay_data.frames for d in f.drivers)
    assert len(tyres_observed) >= 2


def test_procedural_synthetic_demo_fallback():
    """Verifies that _build_synthetic_demo_session satisfies the identical data contract."""
    demo = _build_synthetic_demo_session()
    assert isinstance(demo, ProcessedSession)
    assert demo.info.is_demo is True
    assert demo.info.total_laps == 5

    # Check 10 drivers consistent with DEMO_DRIVERS
    assert len(demo.drivers) == 10
    driver_ids = [d.abbreviation for d in demo.drivers]
    assert "VER" in driver_ids
    assert "NOR" in driver_ids
    assert "STR" in driver_ids

    # Check circuit
    assert len(demo.circuit.x) > 0
    assert len(demo.circuit.x) == len(demo.circuit.y)
    assert demo.circuit.min_x <= demo.circuit.max_x
    assert demo.circuit.min_y <= demo.circuit.max_y

    # Check 5 laps semantics and progression
    laps_observed = set(f.lap for f in demo.replay_data.frames)
    assert laps_observed == {1, 2, 3, 4, 5}

    # Verify monotonic timestamps, frame intervals, and telemetry
    prev_t = -0.5
    for frame in demo.replay_data.frames:
        assert frame.timestamp > prev_t
        assert round(frame.timestamp - prev_t, 2) == 0.5
        prev_t = frame.timestamp

        # Positions must be strictly 1..10 without gaps or duplicates
        positions = [d.position for d in frame.drivers]
        assert sorted(positions) == list(range(1, 11))

        # Every driver in frame must be in demo.drivers
        frame_driver_ids = [d.driver_id for d in frame.drivers]
        assert len(frame_driver_ids) == 10
        assert set(frame_driver_ids) == set(driver_ids)

        # Telemetry fields conform to schema
        for d in frame.drivers:
            assert 1 <= d.sector <= 3
            assert 1 <= d.lap <= 5
            assert d.speed >= 0
            assert 1 <= d.gear <= 8
            assert 0.0 <= d.throttle <= 100.0
            assert isinstance(d.brake, bool)
            assert d.rpm > 0
            assert d.drs in (0, 10, 12, 14)
            assert d.tyre in ("SOFT", "MEDIUM", "HARD")

    # Sectors coverage
    sectors_observed = set(d.sector for f in demo.replay_data.frames for d in f.drivers)
    assert sectors_observed == {1, 2, 3}

    # Duration agrees with max_time
    assert demo.replay_data.max_time == round(demo.replay_data.frames[-1].timestamp, 2)


def test_demo_fallback_via_api(app_client):
    """Verifies REST endpoints for the offline demo replay return 200 with isDemo=True."""
    # Explicit demo metadata route
    resp1 = app_client.get("/api/replay/demo/metadata")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["isDemo"] is True
    assert len(data1["drivers"]) >= 10
    assert len(data1["circuit"]["x"]) > 0

    # Explicit demo full replay route
    resp2 = app_client.get("/api/replay/demo")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["isDemo"] is True
    assert len(data2["frames"]) > 0

    # Path-based demo route with year=0
    resp3 = app_client.get("/api/replay/0/Demo%20Grand%20Prix/R/metadata")
    assert resp3.status_code == 200
    assert resp3.json()["isDemo"] is True


def test_fully_available_real_data_session(app_client):
    """Verifies that when all telemetry and laps datasets are present, processing succeeds and caches."""
    mock_session = MagicMock()
    mock_session.drivers = ["1", "44"]
    mock_session.get_driver.side_effect = lambda drv: {
        "1": {"Abbreviation": "VER", "TeamName": "Red Bull", "TeamColor": "3671C6"},
        "44": {"Abbreviation": "HAM", "TeamName": "Mercedes", "TeamColor": "27F4D2"},
    }[drv]

    # Create mock laps DataFrame
    mock_laps_df = pd.DataFrame({
        "LapNumber": [1, 2],
        "Driver": ["VER", "VER"],
    })
    mock_session._laps = mock_laps_df
    mock_session.laps = mock_laps_df

    mock_lap = MagicMock()
    mock_lap.empty = False
    mock_tel = pd.DataFrame({"X": [10.0, 20.0, 30.0], "Y": [15.0, 25.0, 35.0]})
    mock_lap.get_telemetry.return_value = mock_tel

    mock_laps_obj = MagicMock()
    mock_laps_obj.empty = False
    mock_laps_obj.pick_fastest.return_value = mock_lap
    mock_session.laps.pick_drivers = MagicMock(return_value=mock_laps_obj)

    fake_raw = {
        "VER": pd.DataFrame({
            "X": [10.0, 20.0], "Y": [15.0, 25.0], "Speed": [300.0, 310.0],
            "nGear": [7, 8], "Throttle": [100.0, 100.0], "Brake": [False, False],
            "RPM": [11000.0, 11500.0], "DRS": [0, 1], "Distance": [100.0, 200.0],
            "LapNumber": [1, 1], "Compound": ["MEDIUM", "MEDIUM"], "Sector": [1, 1],
            "t": [0.0, 0.5],
        })
    }

    with patch("services.fastf1_service.fastf1.get_session", return_value=mock_session), \
         patch("telemetry.pipeline.load_driver_raw_telemetry", return_value=fake_raw), \
         patch("services.fastf1_service.fastf1.Cache.enable_cache"):

        proc = pipeline._process_session_sync(2024, "RealGP", "R")
        assert proc is not None
        assert proc.info.event == "RealGP"
        assert len(proc.circuit.x) == 3
        assert len(proc.replay_data.frames) > 0
        # Verify it was cached in memory
        assert (2024, "RealGP", "R") in pipeline._memory_cache


def test_missing_telemetry_raises_and_does_not_cache():
    """When driver raw telemetry is empty, TelemetryDataUnavailableError is raised and not cached."""
    mock_session = MagicMock()
    mock_session.drivers = ["1"]
    mock_session.get_driver.return_value = {"Abbreviation": "VER", "TeamName": "Red Bull", "TeamColor": "3671C6"}
    mock_laps_df = pd.DataFrame({"LapNumber": [1]})
    mock_session._laps = mock_laps_df

    mock_lap = MagicMock()
    mock_lap.empty = False
    mock_lap.get_telemetry.return_value = pd.DataFrame({"X": [1.0, 2.0], "Y": [1.0, 2.0]})
    mock_laps_obj = MagicMock()
    mock_laps_obj.empty = False
    mock_laps_obj.pick_fastest.return_value = mock_lap
    mock_session.laps.pick_drivers = MagicMock(return_value=mock_laps_obj)

    with patch("services.fastf1_service.fastf1.get_session", return_value=mock_session), \
         patch("telemetry.pipeline.load_driver_raw_telemetry", return_value={}), \
         patch("services.fastf1_service.fastf1.Cache.enable_cache"):

        with pytest.raises(TelemetryDataUnavailableError) as exc_info:
            pipeline._process_session_sync(2026, "MissingTelemetryGP", "R")

        assert "telemetry" in str(exc_info.value).lower()
        # Verify nothing was inserted into cache
        assert (2026, "MissingTelemetryGP", "R") not in pipeline._memory_cache


def test_upstream_authentication_failure():
    """Simulates F1 401 Unauthorized / missing archive where _laps is absent after session.load()."""
    mock_session = MagicMock()
    # Delete _laps attribute to simulate missing laps in loaded session
    del mock_session._laps

    with patch("services.fastf1_service.fastf1.get_session", return_value=mock_session), \
         patch("services.fastf1_service.fastf1.Cache.enable_cache"):

        with pytest.raises(TelemetryDataUnavailableError) as exc_info:
            fastf1_service.get_session(2026, "Singapore Grand Prix", "R")

        assert "unavailable" in str(exc_info.value).lower()
        assert "restricted" in str(exc_info.value).lower()


def test_laps_failure_path_in_session_overview():
    """Verifies build_session_overview raises TelemetryDataUnavailableError if _laps is missing,
    avoiding unhandled AttributeError or DataNotLoadedError.
    """
    mock_session = MagicMock()
    del mock_session._laps
    mock_session.drivers = ["1", "44"]

    with pytest.raises(TelemetryDataUnavailableError) as exc_info:
        build_session_overview(mock_session, 2026, "Singapore Grand Prix", "R")

    assert "timing data unavailable" in str(exc_info.value).lower()


def test_safe_error_serialization_and_cors(app_client):
    """Verifies that an unavailable telemetry session returns HTTP 404, valid JSON, and proper CORS."""
    with patch("api.replay.get_processed_session", side_effect=TelemetryDataUnavailableError("Real telemetry restricted")):
        resp = app_client.get(
            "/api/replay/2026/Singapore%20Grand%20Prix/R/metadata",
            headers={"Origin": "http://localhost:3000"},
        )
        assert resp.status_code == 404
        data = resp.json()
        assert "detail" in data
        assert "Real telemetry restricted" in data["detail"]
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_no_invalid_session_inserted_into_cache():
    """Verifies that failed sessions do not poison memory or disk cache."""
    key = (2026, "FailedSessionGP", "R")
    with patch("telemetry.pipeline.fastf1_service.get_session", side_effect=TelemetryDataUnavailableError("Failed session")), \
         pytest.raises(TelemetryDataUnavailableError):
        pipeline._process_session_sync(*key)

    assert key not in pipeline._memory_cache
    assert pipeline.load_cached_session(*key) is None
