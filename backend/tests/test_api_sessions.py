"""Integration tests for the /api/sessions routes."""
from __future__ import annotations
from unittest.mock import patch, MagicMock
import pandas as pd
from models.schemas import SessionInfo, DriverMeta, CircuitData


def test_list_events_success(app_client):
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
        assert data[0]["roundNumber"] == 1


def test_list_events_error_handling(app_client):
    with patch("services.fastf1_service.get_event_schedule", side_effect=Exception("FastF1 network down")):
        resp = app_client.get("/api/sessions/2024/events")
        assert resp.status_code == 502
        assert "Failed to load schedule" in resp.json()["detail"]


def test_get_session_detail_success(app_client):
    mock_session = MagicMock()
    # Mock laps DataFrame
    mock_laps = pd.DataFrame({
        "LapStartTime": [pd.Timedelta(seconds=100.0)],
        "LapTime": [pd.Timedelta(seconds=90.0)],
    })
    mock_session.laps = mock_laps

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

    with patch("services.fastf1_service.get_session", return_value=mock_session), \
         patch("api.sessions.build_session_overview", return_value=(mock_info, mock_drivers, mock_circuit)):
        resp = app_client.get("/api/sessions/2024/Bahrain/R")
        assert resp.status_code == 200
        body = resp.json()
        assert body["info"]["event"] == "Bahrain"
        assert len(body["drivers"]) == 1
        assert body["drivers"][0]["abbreviation"] == "VER"
        assert len(body["circuit"]["x"]) == 3
        assert body["minRaceTime"] == 100.0
        assert body["maxRaceTime"] == 190.0
