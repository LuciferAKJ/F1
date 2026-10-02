"""Dataclasses representing processed replay data (backend-internal, mirrored by Pydantic schemas for the API)."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class DriverFrame:
    driver_id: str  # abbreviation, e.g. "VER"
    x: float
    y: float
    speed: float
    gear: int
    throttle: float
    brake: bool
    rpm: float
    drs: int
    tyre: str
    lap: int
    sector: int
    position: int  # 1-based running order at this instant


@dataclass
class ReplayFrame:
    timestamp: float  # seconds from session start
    lap: int
    drivers: list[DriverFrame] = field(default_factory=list)


@dataclass
class ReplayData:
    frames: list[ReplayFrame]
    min_time: float
    max_time: float
