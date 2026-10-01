"""Integration tests for the /api/replay routes."""
from __future__ import annotations
from unittest.mock import patch, MagicMock
from models.schemas import SessionInfo, DriverMeta, CircuitData
from telemetry.models import ReplayData


def _mock_overview_and_data(sample_replay_data: ReplayData):
    mock_session = MagicMock()
    mock_info = SessionInfo(
        year=2024,
        event="Bahrain",
        session_name="Race",
        session_type="R",
        total_laps=57,
    )
    mock_drivers = [
        DriverMeta(
            abbreviation="VER",
            team_name="Red Bull Racing",
            team_color="#3671C6",
            driver_number="1",
        )
    ]
    mock_circuit = CircuitData(
        x=[0.0, 10.0, 20.0],
        y=[0.0, 15.0, 30.0],
        min_x=0.0,
        max_x=20.0,
        min_y=0.0,
        max_y=30.0,
    )
    return mock_session, mock_info, mock_drivers, mock_circuit


def test_replay_status(app_client):
    resp = app_client.get("/api/replay/status")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_get_replay(app_client, sample_replay_data):
    mock_session, mock_info, mock_drivers, mock_circuit = _mock_overview_and_data(sample_replay_data)

    with patch("services.fastf1_service.get_session", return_value=mock_session), \
         patch("api.replay.build_session_overview", return_value=(mock_info, mock_drivers, mock_circuit)), \
         patch("api.replay.get_replay_data", return_value=sample_replay_data):

        resp = app_client.get("/api/replay/2024/Bahrain/R")
        assert resp.status_code == 200
        data = resp.json()
        assert data["info"]["event"] == "Bahrain"
        assert len(data["frames"]) == len(sample_replay_data.frames)
        assert data["raceDuration"] == sample_replay_data.max_time


def test_get_replay_metadata(app_client, sample_replay_data):
    mock_session, mock_info, mock_drivers, mock_circuit = _mock_overview_and_data(sample_replay_data)

    with patch("services.fastf1_service.get_session", return_value=mock_session), \
         patch("api.replay.build_session_overview", return_value=(mock_info, mock_drivers, mock_circuit)), \
         patch("api.replay.get_replay_data", return_value=sample_replay_data):

        resp = app_client.get("/api/replay/2024/Bahrain/R/metadata")
        assert resp.status_code == 200
        data = resp.json()
        assert data["totalLaps"] == 57
        assert data["frameCount"] == len(sample_replay_data.frames)
        assert data["duration"] == sample_replay_data.max_time


def test_get_replay_frame(app_client, sample_replay_data):
    mock_session, mock_info, mock_drivers, mock_circuit = _mock_overview_and_data(sample_replay_data)

    with patch("services.fastf1_service.get_session", return_value=mock_session), \
         patch("api.replay.build_session_overview", return_value=(mock_info, mock_drivers, mock_circuit)), \
         patch("api.replay.get_replay_data", return_value=sample_replay_data):

        resp = app_client.get("/api/replay/2024/Bahrain/R/frame/1.0")
        assert resp.status_code == 200
        data = resp.json()
        assert data["frame"] is not None
        assert data["frame"]["timestamp"] == 1.0
