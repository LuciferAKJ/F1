"""Integration tests for the /api/replay routes."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

from telemetry.models import ProcessedSession


def test_replay_status(app_client):
    resp = app_client.get("/api/replay/status")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_get_replay(app_client, sample_processed_session: ProcessedSession):
    with patch("api.replay.get_processed_session", new_callable=AsyncMock, return_value=sample_processed_session):
        resp = app_client.get("/api/replay/2024/Bahrain/R")
        assert resp.status_code == 200
        data = resp.json()
        assert data["info"]["event"] == "Bahrain"
        assert len(data["frames"]) == len(sample_processed_session.replay_data.frames)
        assert data["raceDuration"] == sample_processed_session.replay_data.max_time


def test_get_replay_metadata(app_client, sample_processed_session: ProcessedSession):
    with patch("api.replay.get_processed_session", new_callable=AsyncMock, return_value=sample_processed_session):
        resp = app_client.get("/api/replay/2024/Bahrain/R/metadata")
        assert resp.status_code == 200
        data = resp.json()
        assert data["totalLaps"] == 57
        assert data["frameCount"] == len(sample_processed_session.replay_data.frames)
        assert data["duration"] == sample_processed_session.replay_data.max_time


def test_get_replay_frame(app_client, sample_processed_session: ProcessedSession):
    with patch("api.replay.get_processed_session", new_callable=AsyncMock, return_value=sample_processed_session):
        resp = app_client.get("/api/replay/2024/Bahrain/R/frame/1.0")
        assert resp.status_code == 200
        data = resp.json()
        assert data["frame"] is not None
        assert data["frame"]["timestamp"] == 1.0


def test_no_duplicate_fastf1_loads_across_endpoints(app_client, sample_processed_session: ProcessedSession):
    """Verify that multiple endpoint calls for the same session hit cache and don't re-trigger FastF1 loads."""
    with patch("telemetry.pipeline.fastf1_service.get_session") as mock_get_session, \
         patch("telemetry.pipeline.load_cached_session", return_value=None), \
         patch("telemetry.pipeline.save_cached_session"), \
         patch("telemetry.pipeline.build_session_overview", return_value=(sample_processed_session.info, sample_processed_session.drivers, sample_processed_session.circuit)), \
         patch("telemetry.pipeline.load_driver_raw_telemetry", return_value={}), \
         patch("telemetry.pipeline.build_replay_frames", return_value=sample_processed_session.replay_data):

        mock_session = mock_get_session.return_value
        mock_session.drivers = []

        # Request 1: metadata
        resp1 = app_client.get("/api/replay/2026/Monaco/R/metadata")
        assert resp1.status_code == 200

        # Request 2: full replay
        resp2 = app_client.get("/api/replay/2026/Monaco/R")
        assert resp2.status_code == 200

        # Request 3: single frame
        resp3 = app_client.get("/api/replay/2026/Monaco/R/frame/1.0")
        assert resp3.status_code == 200

        # FastF1 session load must have occurred only ONCE
        assert mock_get_session.call_count == 1
