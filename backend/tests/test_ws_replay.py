"""WebSocket integration tests for /ws/replay."""
from __future__ import annotations
from unittest.mock import patch
from telemetry.models import ReplayData


def test_ws_replay_metadata_and_interaction(app_client, sample_replay_data: ReplayData):
    with patch("api.ws_replay.get_replay_data", return_value=sample_replay_data):
        with app_client.websocket_connect("/ws/replay/2024/Bahrain/R") as websocket:
            # First message received is always metadata
            msg = websocket.receive_json()
            assert msg["type"] == "metadata"
            assert msg["duration"] == sample_replay_data.max_time
            assert msg["frameCount"] == len(sample_replay_data.frames)

            # Test sending client control messages
            websocket.send_json({"action": "speed", "value": 2.0})
            websocket.send_json({"action": "seek", "time": 1.5})
            websocket.send_json({"action": "pause"})


def test_ws_replay_error_handling(app_client):
    with patch("api.ws_replay.get_replay_data", side_effect=Exception("Data missing")):
        with app_client.websocket_connect("/ws/replay/2024/Bahrain/R") as websocket:
            msg = websocket.receive_json()
            assert msg["type"] == "error"
            assert "Failed to load replay" in msg["message"]
