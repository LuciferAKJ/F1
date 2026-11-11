"""Integration and unit tests for /api/sessions routes and availability service."""
from __future__ import annotations

import datetime
import os
import pickle
from unittest.mock import AsyncMock, patch

import pandas as pd
import pytest

from models.schemas import CircuitData, DriverMeta, SessionInfo
from services.availability_service import clear_availability_cache
from telemetry.models import ProcessedSession, ReplayData


def _make_valid_session(
    year: int,
    event: str,
    session_type: str = "R",
    sample_replay_data: ReplayData | None = None,
) -> ProcessedSession:
    if sample_replay_data is None:
        from telemetry.models import DriverFrame, ReplayFrame

        frame = ReplayFrame(
            timestamp=0.0,
            lap=1,
            drivers=[
                DriverFrame(
                    driver_id="VER",
                    x=10.0,
                    y=20.0,
                    speed=280.0,
                    gear=7,
                    throttle=100.0,
                    brake=False,
                    rpm=11200.0,
                    drs=0,
                    tyre="SOFT",
                    lap=1,
                    sector=1,
                    position=1,
                )
            ],
        )
        sample_replay_data = ReplayData(frames=[frame], min_time=0.0, max_time=10.0)

    return ProcessedSession(
        info=SessionInfo(
            year=year,
            event=event,
            session_type=session_type,
            session_name="Race" if session_type == "R" else session_type,
            total_laps=57,
            is_demo=False,
        ),
        drivers=[
            DriverMeta(
                abbreviation="VER",
                team_name="Red Bull Racing",
                team_color="#3671C6",
                driver_number="1",
            )
        ],
        circuit=CircuitData(
            x=[0.0, 10.0, 20.0],
            y=[0.0, 5.0, 0.0],
            min_x=0.0,
            max_x=20.0,
            min_y=0.0,
            max_y=5.0,
        ),
        replay_data=sample_replay_data,
    )


def _write_cache_file(cache_root: str, filename: str, payload: object) -> str:
    replay_dir = os.path.join(cache_root, "replay")
    os.makedirs(replay_dir, exist_ok=True)
    path = os.path.join(replay_dir, filename)
    with open(path, "wb") as f:
        pickle.dump(payload, f)
    return path


@pytest.fixture(autouse=True)
def _isolated_availability_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("FASTF1_CACHE_DIR", str(tmp_path))
    clear_availability_cache()
    yield
    clear_availability_cache()


def test_list_events_completed_unverified_not_marked_available(app_client):
    mock_df = pd.DataFrame([
        {
            "RoundNumber": 1,
            "EventName": "Bahrain Grand Prix",
            "Country": "Bahrain",
            "Location": "Sakhir",
            "EventDate": pd.Timestamp("2024-03-02"),
        }
    ])
    with patch("services.fastf1_service.get_event_schedule", return_value=mock_df):
        resp = app_client.get("/api/sessions/2024/events")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["eventName"] == "Bahrain Grand Prix"
        assert data[0]["status"] == "unverified"
        assert data[0]["hasTelemetry"] is False
        assert data[0]["verified"] is False
        assert data[0]["circuit"] is None


def test_list_events_honours_configured_cache_and_session_specificity(app_client, tmp_path, sample_replay_data):
    mock_df = pd.DataFrame([
        {
            "RoundNumber": 0,
            "EventName": "Pre-Season Testing",
            "Country": "Bahrain",
            "Location": "Sakhir",
            "EventDate": pd.Timestamp("2025-02-26"),
        },
        {
            "RoundNumber": 1,
            "EventName": "Australian Grand Prix",
            "Country": "Australia",
            "Location": "Melbourne",
            "EventDate": pd.Timestamp("2025-03-16"),
            "EventFormat": "conventional",
        },
        {
            "RoundNumber": 24,
            "EventName": "Future Grand Prix",
            "Country": "Futureland",
            "Location": "Future City",
            "EventDate": pd.Timestamp(datetime.date.today() + datetime.timedelta(days=30)),
            "EventFormat": "conventional",
        },
    ])
    _write_cache_file(
        str(tmp_path),
        "2025_Australian_Grand_Prix_R.pkl",
        _make_valid_session(2025, "Australian Grand Prix", "R", sample_replay_data),
    )

    with patch("services.fastf1_service.get_event_schedule", return_value=mock_df):
        # Race session should mark Australian GP available, Testing restricted, Future upcoming
        resp_r = app_client.get("/api/sessions/2025/events?session_type=R")
        assert resp_r.status_code == 200
        items_r = resp_r.json()
        assert items_r[0]["status"] == "restricted"
        assert items_r[0]["hasTelemetry"] is False

        assert items_r[1]["status"] == "available"
        assert items_r[1]["hasTelemetry"] is True
        assert items_r[1]["verified"] is True
        assert items_r[1]["verifiedSessions"] == ["R"]
        assert items_r[1]["circuit"] is not None

        assert items_r[2]["status"] == "upcoming"
        assert items_r[2]["hasTelemetry"] is False

        # Qualifying (Q) for Australian GP was NOT cached -> must be unverified, NOT available!
        resp_q = app_client.get("/api/sessions/2025/events?session_type=Q")
        assert resp_q.status_code == 200
        items_q = resp_q.json()
        assert items_q[1]["status"] == "unverified"
        assert items_q[1]["hasTelemetry"] is False
        assert items_q[1]["verified"] is False
        assert items_q[1]["verifiedSessions"] == ["R"]

        # Sprint (S) on a conventional weekend does not exist -> unavailable
        resp_s = app_client.get("/api/sessions/2025/events?session_type=S")
        assert resp_s.status_code == 200
        items_s = resp_s.json()
        assert items_s[1]["status"] == "unavailable"
        assert items_s[1]["sessionExists"] is False


def test_pre_2018_season_classified_restricted(app_client):
    mock_df = pd.DataFrame([
        {
            "RoundNumber": 1,
            "EventName": "Australian Grand Prix",
            "Country": "Australia",
            "Location": "Melbourne",
            "EventDate": pd.Timestamp("2017-03-26"),
        }
    ])
    with patch("services.fastf1_service.get_event_schedule", return_value=mock_df):
        resp = app_client.get("/api/sessions/2017/events")
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["status"] == "restricted"
        assert data[0]["hasTelemetry"] is False


def test_latest_available_no_cached_sessions_returns_demo_explicitly(app_client):
    resp = app_client.get("/api/sessions/latest-available")
    assert resp.status_code == 200
    data = resp.json()
    assert data["year"] == 0
    assert data["isDemo"] is True
    assert data["hasVerifiedRealSession"] is False
    assert data["eventName"] == "Demo Grand Prix"
    assert data["hasTelemetry"] is True
    assert data["circuit"] is not None


def test_latest_available_supports_current_season_beyond_2024_and_picks_latest_round(app_client, tmp_path, sample_replay_data):
    mock_df_2026 = pd.DataFrame([
        {
            "RoundNumber": 1,
            "EventName": "Australian Grand Prix",
            "Country": "Australia",
            "Location": "Melbourne",
            "EventDate": pd.Timestamp("2026-03-08"),
        },
        {
            "RoundNumber": 16,
            "EventName": "Azerbaijan Grand Prix",
            "Country": "Azerbaijan",
            "Location": "Baku",
            "EventDate": pd.Timestamp("2026-09-20"),
        },
    ])
    # Deliberately name earlier round lexicographically later or write both to test schedule date sorting
    _write_cache_file(
        str(tmp_path),
        "2026_Australian_Grand_Prix_R.pkl",
        _make_valid_session(2026, "Australian Grand Prix", "R", sample_replay_data),
    )
    _write_cache_file(
        str(tmp_path),
        "2026_Azerbaijan_Race.pkl",
        _make_valid_session(2026, "Azerbaijan", "R", sample_replay_data),
    )

    with patch("services.fastf1_service.get_event_schedule", return_value=mock_df_2026):
        resp = app_client.get("/api/sessions/latest-available")
        assert resp.status_code == 200
        data = resp.json()
        assert data["year"] == 2026
        assert data["eventName"] == "Azerbaijan Grand Prix"
        assert data["roundNumber"] == 16
        assert data["country"] == "Azerbaijan"
        assert data["location"] == "Baku"
        assert data["eventDate"] == "2026-09-20"
        assert data["isDemo"] is False
        assert data["hasVerifiedRealSession"] is True
        assert data["hasTelemetry"] is True
        assert data["circuit"] is not None


def test_corrupted_or_empty_cache_not_marked_available(app_client, tmp_path):
    mock_df = pd.DataFrame([
        {
            "RoundNumber": 1,
            "EventName": "Bahrain Grand Prix",
            "Country": "Bahrain",
            "Location": "Sakhir",
            "EventDate": pd.Timestamp("2024-03-02"),
        }
    ])
    # Write empty frames / empty circuit object
    empty_session = ProcessedSession(
        info=SessionInfo(year=2024, event="Bahrain Grand Prix", session_type="R", session_name="Race", total_laps=57),
        drivers=[],
        circuit=CircuitData(x=[], y=[], min_x=0.0, max_x=0.0, min_y=0.0, max_y=0.0),
        replay_data=ReplayData(frames=[], min_time=0.0, max_time=0.0),
    )
    _write_cache_file(str(tmp_path), "2024_Bahrain_Grand_Prix_R.pkl", empty_session)

    # Also write raw corrupted bytes for another file
    replay_dir = os.path.join(str(tmp_path), "replay")
    with open(os.path.join(replay_dir, "2024_Corrupt_R.pkl"), "wb") as f:
        f.write(b"not a valid pickle")

    with patch("services.fastf1_service.get_event_schedule", return_value=mock_df):
        # latest-available must NOT return corrupted session, should return Demo fallback
        latest_resp = app_client.get("/api/sessions/latest-available")
        assert latest_resp.status_code == 200
        latest = latest_resp.json()
        assert latest["isDemo"] is True
        assert latest["hasVerifiedRealSession"] is False

        # Bahrain should be unavailable due to corrupted/empty cache file
        events_resp = app_client.get("/api/sessions/2024/events")
        assert events_resp.status_code == 200
        events = events_resp.json()
        assert events[0]["status"] == "unavailable"
        assert events[0]["hasTelemetry"] is False


def test_availability_endpoint_unknown_on_schedule_error_and_verify_on_demand(app_client, sample_replay_data):
    with patch("services.fastf1_service.get_event_schedule", side_effect=RuntimeError("Schedule offline")):
        resp = app_client.get("/api/sessions/2024/Bahrain/R/availability")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "unknown"
        assert body["hasTelemetry"] is False

    mock_df = pd.DataFrame([
        {
            "RoundNumber": 1,
            "EventName": "Bahrain Grand Prix",
            "Country": "Bahrain",
            "Location": "Sakhir",
            "EventDate": pd.Timestamp("2024-03-02"),
        }
    ])
    valid_proc = _make_valid_session(2024, "Bahrain Grand Prix", "R", sample_replay_data)

    with (
        patch("services.fastf1_service.get_event_schedule", return_value=mock_df),
        patch("telemetry.pipeline.get_processed_session", new_callable=AsyncMock, return_value=valid_proc),
    ):
        resp_verify = app_client.get("/api/sessions/2024/Bahrain%20Grand%20Prix/R/availability?verify=true")
        assert resp_verify.status_code == 200
        body = resp_verify.json()
        assert body["status"] == "available"
        assert body["hasTelemetry"] is True
        assert body["verified"] is True
        assert body["circuit"] is not None


def test_list_events_error_handling(app_client):
    with patch("services.fastf1_service.get_event_schedule", side_effect=Exception("FastF1 network down")):
        resp = app_client.get("/api/sessions/2024/events")
        assert resp.status_code == 502
        assert "Failed to load schedule" in resp.json()["detail"]


def test_get_session_detail_success(app_client, sample_processed_session: ProcessedSession):
    with patch("api.sessions.get_processed_session", new_callable=AsyncMock, return_value=sample_processed_session):
        resp = app_client.get("/api/sessions/2024/Bahrain/R")
        assert resp.status_code == 200
        body = resp.json()
        assert body["info"]["event"] == "Bahrain"
        assert len(body["drivers"]) == 2
        assert body["drivers"][0]["abbreviation"] == "VER"
        assert len(body["circuit"]["x"]) == 3
        assert body["minRaceTime"] == sample_processed_session.replay_data.min_time
        assert body["maxRaceTime"] == sample_processed_session.replay_data.max_time
