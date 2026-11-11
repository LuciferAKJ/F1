from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

AvailabilityStatus = Literal[
    "available",
    "upcoming",
    "unverified",
    "unavailable",
    "restricted",
    "unknown",
]


class CamelModel(BaseModel):
    """Base model that serializes to camelCase JSON (frontend-friendly) while
    still accepting/using snake_case attribute names in Python."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class CircuitData(CamelModel):
    x: list[float]
    y: list[float]
    min_x: float
    max_x: float
    min_y: float
    max_y: float


class SeasonEvent(CamelModel):
    round_number: int
    event_name: str
    country: str
    location: str
    event_date: str
    session_type: str = "R"
    status: AvailabilityStatus = "unknown"
    has_telemetry: bool = False
    event_exists: bool = True
    has_occurred: bool = False
    session_exists: bool = True
    session_supported: bool = True
    verified: bool = False
    verified_sessions: list[str] = Field(default_factory=list)
    total_laps: int | None = None
    driver_count: int | None = None
    circuit: CircuitData | None = None
    status_reason: str | None = None


class SessionAvailabilityResponse(CamelModel):
    year: int
    event: str
    session_type: str
    round_number: int | None = None
    event_name: str | None = None
    country: str | None = None
    location: str | None = None
    event_date: str | None = None
    status: AvailabilityStatus
    has_telemetry: bool = False
    event_exists: bool = False
    has_occurred: bool = False
    session_exists: bool = False
    session_supported: bool = False
    verified: bool = False
    is_demo: bool = False
    total_laps: int | None = None
    driver_count: int | None = None
    circuit: CircuitData | None = None
    status_reason: str | None = None


class LatestAvailableSession(CamelModel):
    year: int
    event: str
    session_type: str = "R"
    round_number: int
    event_name: str
    country: str
    location: str
    event_date: str
    is_demo: bool = False
    has_telemetry: bool = False
    verified: bool = False
    has_verified_real_session: bool = False
    status: AvailabilityStatus = "available"
    total_laps: int | None = None
    driver_count: int | None = None
    circuit: CircuitData | None = None
    status_reason: str | None = None


class SessionInfo(CamelModel):
    year: int
    event: str
    session_type: str
    session_name: str
    total_laps: int | None = None
    is_demo: bool = False


class DriverMeta(CamelModel):
    abbreviation: str
    team_name: str
    team_color: str
    driver_number: str


class SessionDetailResponse(CamelModel):
    info: SessionInfo
    drivers: list[DriverMeta]
    circuit: CircuitData
    min_race_time: float
    max_race_time: float


class DriverFrameOut(CamelModel):
    driver_id: str
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
    position: int


class ReplayFrameOut(CamelModel):
    timestamp: float
    lap: int
    drivers: list[DriverFrameOut]


class ReplayResponse(CamelModel):
    info: SessionInfo
    drivers: list[DriverMeta]
    circuit: CircuitData
    frames: list[ReplayFrameOut]
    race_duration: float
    is_demo: bool = False


class ReplayMetadataResponse(CamelModel):
    info: SessionInfo
    drivers: list[DriverMeta]
    circuit: CircuitData
    total_laps: int | None
    duration: float
    frame_interval: float
    frame_count: int
    is_demo: bool = False


class ReplayFrameResponse(CamelModel):
    frame: ReplayFrameOut | None
