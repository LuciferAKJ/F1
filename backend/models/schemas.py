from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model that serializes to camelCase JSON (frontend-friendly) while
    still accepting/using snake_case attribute names in Python."""
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SeasonEvent(CamelModel):
    round_number: int
    event_name: str
    country: str
    location: str
    event_date: str


class SessionInfo(CamelModel):
    year: int
    event: str
    session_type: str
    session_name: str
    total_laps: int | None = None


class DriverMeta(CamelModel):
    abbreviation: str
    team_name: str
    team_color: str
    driver_number: str


class CircuitData(CamelModel):
    x: list[float]
    y: list[float]
    min_x: float
    max_x: float
    min_y: float
    max_y: float


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


class ReplayMetadataResponse(CamelModel):
    info: SessionInfo
    drivers: list[DriverMeta]
    circuit: CircuitData
    total_laps: int | None
    duration: float
    frame_interval: float
    frame_count: int


class ReplayFrameResponse(CamelModel):
    frame: ReplayFrameOut | None
