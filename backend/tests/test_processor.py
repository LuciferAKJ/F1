"""Unit tests for telemetry.processor frame interpolation and replay frame construction."""

import pandas as pd
from telemetry.processor import _interpolate_row, build_replay_frames


def test_interpolate_row_out_of_bounds():
    df = pd.DataFrame(
        {
            "t": [0.0, 1.0, 2.0],
            "X": [0.0, 10.0, 20.0],
            "Y": [0.0, 5.0, 10.0],
            "Speed": [100, 200, 300],
            "nGear": [1, 2, 3],
            "Throttle": [50, 100, 100],
            "Brake": [False, False, True],
            "RPM": [5000, 8000, 10000],
            "DRS": [0, 0, 10],
            "Compound": ["MEDIUM", "MEDIUM", "MEDIUM"],
            "LapNumber": [1, 1, 1],
            "Sector": [1, 1, 2],
            "Distance": [0, 50, 100],
        }
    )

    assert _interpolate_row(df, -0.5) is None
    assert _interpolate_row(df, 2.5) is None


def test_interpolate_row_exact_and_midpoint():
    df = pd.DataFrame(
        {
            "t": [0.0, 2.0],
            "X": [0.0, 20.0],
            "Y": [0.0, 10.0],
            "Speed": [100.0, 200.0],
            "nGear": [1, 2],
            "Throttle": [50.0, 100.0],
            "Brake": [False, True],
            "RPM": [5000.0, 10000.0],
            "DRS": [0, 10],
            "Compound": ["MEDIUM", "MEDIUM"],
            "LapNumber": [1, 1],
            "Sector": [1, 2],
            "Distance": [0.0, 100.0],
        }
    )

    row = _interpolate_row(df, 1.0)
    assert row is not None
    assert row["x"] == 10.0
    assert row["y"] == 5.0
    assert row["speed"] == 150.0
    assert row["distance"] == 50.0


def test_build_replay_frames_empty():
    replay_data = build_replay_frames({})
    assert replay_data.frames == []
    assert replay_data.min_time == 0.0
    assert replay_data.max_time == 0.0
