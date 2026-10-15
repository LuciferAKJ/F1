"""Integration tests for the /api/sessions routes."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pandas as pd

from telemetry.models import ProcessedSession


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
