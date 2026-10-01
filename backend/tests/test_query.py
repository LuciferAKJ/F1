"""Unit tests for telemetry.query filtering and timestamp lookup."""

from telemetry.models import DriverFrame, ReplayFrame
from telemetry.query import filter_frames, frame_at_timestamp


def make_test_frames() -> list[ReplayFrame]:
    return [
        ReplayFrame(
            timestamp=0.0,
            lap=1,
            drivers=[
                DriverFrame(
                    driver_id="VER",
                    x=100.0,
                    y=200.0,
                    speed=300.0,
                    gear=7,
                    throttle=100.0,
                    brake=False,
                    rpm=11000,
                    drs=0,
                    tyre="MEDIUM",
                    lap=1,
                    sector=1,
                    position=1,
                ),
                DriverFrame(
                    driver_id="HAM",
                    x=90.0,
                    y=190.0,
                    speed=295.0,
                    gear=7,
                    throttle=100.0,
                    brake=False,
                    rpm=11000,
                    drs=0,
                    tyre="MEDIUM",
                    lap=1,
                    sector=1,
                    position=2,
                ),
            ],
        ),
        ReplayFrame(
            timestamp=1.0,
            lap=1,
            drivers=[
                DriverFrame(
                    driver_id="VER",
                    x=110.0,
                    y=210.0,
                    speed=305.0,
                    gear=7,
                    throttle=100.0,
                    brake=False,
                    rpm=11100,
                    drs=0,
                    tyre="MEDIUM",
                    lap=1,
                    sector=1,
                    position=1,
                ),
            ],
        ),
        ReplayFrame(
            timestamp=2.0,
            lap=2,
            drivers=[
                DriverFrame(
                    driver_id="VER",
                    x=120.0,
                    y=220.0,
                    speed=310.0,
                    gear=8,
                    throttle=100.0,
                    brake=False,
                    rpm=11200,
                    drs=0,
                    tyre="MEDIUM",
                    lap=2,
                    sector=1,
                    position=1,
                ),
            ],
        ),
    ]


def test_frame_at_timestamp_nearest():
    frames = make_test_frames()
    assert frame_at_timestamp(frames, 0.2) == frames[0]
    assert frame_at_timestamp(frames, 0.8) == frames[1]
    assert frame_at_timestamp(frames, 2.5) == frames[2]
    assert frame_at_timestamp([], 1.0) is None


def test_filter_frames_by_time():
    frames = make_test_frames()
    filtered = filter_frames(frames, start_time=0.5, end_time=1.5)
    assert len(filtered) == 1
    assert filtered[0].timestamp == 1.0


def test_filter_frames_by_lap():
    frames = make_test_frames()
    lap1 = filter_frames(frames, lap=1)
    assert len(lap1) == 2
    lap2 = filter_frames(frames, lap=2)
    assert len(lap2) == 1


def test_filter_frames_by_driver():
    frames = make_test_frames()
    ham_only = filter_frames(frames, driver="HAM")
    assert len(ham_only) == 1
    assert ham_only[0].drivers[0].driver_id == "HAM"
