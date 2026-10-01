"""Smoke test: verify the test framework is correctly wired up."""
from telemetry.models import DriverFrame, ReplayFrame, ReplayData


def test_driver_frame_creation(sample_driver_frame: DriverFrame) -> None:
    assert sample_driver_frame.driver_id == "VER"
    assert sample_driver_frame.position == 1
    assert sample_driver_frame.speed == 300.0


def test_sample_replay_frames_structure(sample_replay_frames: list[ReplayFrame]) -> None:
    assert len(sample_replay_frames) == 7
    assert sample_replay_frames[0].timestamp == 0.0
    assert sample_replay_frames[-1].timestamp == 3.0
    # Verify the position swap in frame index 4
    frame4 = sample_replay_frames[4]
    positions = {d.driver_id: d.position for d in frame4.drivers}
    assert positions["HAM"] == 1
    assert positions["VER"] == 2


def test_sample_replay_data(sample_replay_data: ReplayData) -> None:
    assert sample_replay_data.min_time == 0.0
    assert sample_replay_data.max_time == 3.0
    assert len(sample_replay_data.frames) == 7


def test_health_endpoint(app_client) -> None:
    resp = app_client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
