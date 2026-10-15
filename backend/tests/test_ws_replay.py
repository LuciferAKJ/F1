"""WebSocket integration tests for /ws/replay."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

from telemetry.models import ProcessedSession


def test_ws_replay_metadata_and_interaction(app_client, sample_processed_session: ProcessedSession):
    with (
        patch("api.ws_replay.get_processed_session", new_callable=AsyncMock, return_value=sample_processed_session),
        app_client.websocket_connect("/ws/replay/2024/Bahrain/R") as websocket,
    ):
        # First message received is always metadata
        msg = websocket.receive_json()
        assert msg["type"] == "metadata"
        assert msg["duration"] == sample_processed_session.replay_data.max_time
        assert msg["frameCount"] == len(sample_processed_session.replay_data.frames)

        # Test sending client control messages
        websocket.send_json({"action": "speed", "value": 2.0})
        websocket.send_json({"action": "seek", "time": 1.5})
        websocket.send_json({"action": "pause"})


def test_ws_replay_error_handling(app_client):
    with (
        patch("api.ws_replay.get_processed_session", new_callable=AsyncMock, side_effect=Exception("Data missing")),
        app_client.websocket_connect("/ws/replay/2024/Bahrain/R") as websocket,
    ):
        msg = websocket.receive_json()
        assert msg["type"] == "error"
        assert "Failed to load replay" in msg["message"]
