"""Unit tests for telemetry.loader module."""
from __future__ import annotations

from telemetry.loader import _sector_for_row


def test_sector_for_row_valid_sectors():
    # s1 = 30.0s, s2 cumulative = 70.0s
    s1 = 30.0
    s2 = 70.0

    # Sector 1
    assert _sector_for_row(10.0, s1, s2) == 1
    assert _sector_for_row(30.0, s1, s2) == 1

    # Sector 2
    assert _sector_for_row(30.1, s1, s2) == 2
    assert _sector_for_row(70.0, s1, s2) == 2

    # Sector 3
    assert _sector_for_row(70.1, s1, s2) == 3
    assert _sector_for_row(90.0, s1, s2) == 3


def test_sector_for_row_none_handling():
    # When sector 1 is None, defaults to sector 3 unless sector 2 checks match
    assert _sector_for_row(15.0, None, 50.0) == 2
    assert _sector_for_row(60.0, None, 50.0) == 3

    # When both are None
    assert _sector_for_row(25.0, None, None) == 3
