import logging

from fastapi import APIRouter, HTTPException, Path, Query

from models.schemas import (
    DriverFrameOut,
    ReplayFrameOut,
    ReplayFrameResponse,
    ReplayMetadataResponse,
    ReplayResponse,
)
from services import fastf1_service
from services.session_overview_service import build_session_overview
from telemetry.pipeline import get_replay_data
from telemetry.processor import FRAME_INTERVAL_S
from telemetry.query import filter_frames, frame_at_timestamp

logger = logging.getLogger(__name__)
router = APIRouter()


def _to_frame_out(f) -> ReplayFrameOut:
    return ReplayFrameOut(
        timestamp=f.timestamp, lap=f.lap,
        drivers=[
            DriverFrameOut(
                driver_id=d.driver_id, x=d.x, y=d.y, speed=d.speed, gear=d.gear,
                throttle=d.throttle, brake=d.brake, rpm=d.rpm, drs=d.drs,
                tyre=d.tyre, lap=d.lap, sector=d.sector, position=d.position,
            )
            for d in f.drivers
        ],
    )


def _load_overview_and_replay(year: int, event: str, session_type: str):
    try:
        session = fastf1_service.get_session(year, event, session_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load session: {exc}") from exc

    info, drivers, circuit = build_session_overview(session, year, event, session_type)
    if not circuit.x:
        raise HTTPException(status_code=404, detail="No telemetry available to build circuit map")

    try:
        replay_data = get_replay_data(year, event, session_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to build replay frames: {exc}") from exc

    if not replay_data.frames:
        raise HTTPException(status_code=404, detail="No telemetry frames could be generated for this session")

    return info, drivers, circuit, replay_data


@router.get("/status")
def replay_status() -> dict:
    """Lightweight readiness check for the replay subsystem."""
    return {"status": "ready"}


@router.get("/{year}/{event}/{session_type}", response_model=ReplayResponse)
def get_replay(
    year: int = Path(..., ge=1950, le=2050, description="Championship season year"),
    event: str = Path(..., min_length=1, max_length=100),
    session_type: str = Path(..., min_length=1, max_length=10),
    start_time: float | None = Query(None, ge=0.0, description="Seconds from race start"),
    end_time: float | None = Query(None, ge=0.0, description="Seconds from race start"),
    lap: int | None = Query(None, ge=1, le=200, description="Restrict to a single lap"),
    driver: str | None = Query(None, min_length=1, max_length=5, description="Restrict to a single driver abbreviation"),
) -> ReplayResponse:
    """Full (or filtered) replay payload: circuit map, driver metadata, synchronized
    frames, race duration. Use start_time/end_time/lap/driver to fetch only a segment,
    e.g. /api/replay/2024/Monaco/R?lap=25
    """
    info, drivers, circuit, replay_data = _load_overview_and_replay(year, event, session_type)
    frames = filter_frames(replay_data.frames, start_time=start_time, end_time=end_time, lap=lap, driver=driver)

    return ReplayResponse(
        info=info, drivers=drivers, circuit=circuit,
        frames=[_to_frame_out(f) for f in frames], race_duration=replay_data.max_time,
    )


@router.get("/{year}/{event}/{session_type}/metadata", response_model=ReplayMetadataResponse)
def get_replay_metadata(
    year: int = Path(..., ge=1950, le=2050, description="Championship season year"),
    event: str = Path(..., min_length=1, max_length=100),
    session_type: str = Path(..., min_length=1, max_length=10),
) -> ReplayMetadataResponse:
    """Lightweight payload: drivers, teams, colors, total laps, duration, circuit info.
    No frame data - fetch this first, then request frames/segments separately.
    """
    info, drivers, circuit, replay_data = _load_overview_and_replay(year, event, session_type)
    return ReplayMetadataResponse(
        info=info, drivers=drivers, circuit=circuit,
        total_laps=info.total_laps, duration=replay_data.max_time,
        frame_interval=FRAME_INTERVAL_S, frame_count=len(replay_data.frames),
    )


@router.get("/{year}/{event}/{session_type}/frame/{timestamp}", response_model=ReplayFrameResponse)
def get_replay_frame(
    year: int = Path(..., ge=1950, le=2050, description="Championship season year"),
    event: str = Path(..., min_length=1, max_length=100),
    session_type: str = Path(..., min_length=1, max_length=10),
    timestamp: float = Path(..., ge=0.0, description="Race timestamp in seconds"),
) -> ReplayFrameResponse:
    """All driver positions/telemetry at a specific race-time timestamp (nearest available frame)."""
    _, _, _, replay_data = _load_overview_and_replay(year, event, session_type)
    frame = frame_at_timestamp(replay_data.frames, timestamp)
    return ReplayFrameResponse(frame=_to_frame_out(frame) if frame else None)
