import logging

from fastapi import APIRouter, HTTPException, Path, Query

from models.schemas import (
    LatestAvailableSession,
    SeasonEvent,
    SessionAvailabilityResponse,
    SessionDetailResponse,
)
from services.availability_service import (
    check_session_availability,
    get_latest_available_session,
    get_season_events_with_availability,
)
from telemetry.exceptions import TelemetryDataUnavailableError
from telemetry.pipeline import get_processed_session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/latest-available", response_model=LatestAvailableSession)
def latest_available() -> LatestAvailableSession:
    """Return the latest verified completed Grand Prix with available replay telemetry,
    or explicit Demo Grand Prix sample fallback if no real verified replay exists."""
    return get_latest_available_session()


@router.get("/{year}/events", response_model=list[SeasonEvent])
def list_events(
    year: int = Path(..., ge=0, le=2050, description="Championship season year (0 for demo)"),
    session_type: str = Query("R", min_length=1, max_length=10, description="Session type for availability checks"),
) -> list[SeasonEvent]:
    try:
        return get_season_events_with_availability(year, session_type=session_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load schedule: {exc}") from exc


@router.get("/{year}/{event}/{session_type}/availability", response_model=SessionAvailabilityResponse)
async def get_session_availability(
    year: int = Path(..., ge=0, le=2050, description="Championship season year (0 for demo)"),
    event: str = Path(..., min_length=1, max_length=100),
    session_type: str = Path(..., min_length=1, max_length=10),
    verify: bool = Query(False, description="When true, attempt to load and verify this single session"),
) -> SessionAvailabilityResponse:
    return await check_session_availability(year, event, session_type, verify=verify)


@router.get("/{year}/{event}/{session_type}", response_model=SessionDetailResponse)
async def get_session_detail(
    year: int = Path(..., ge=0, le=2050, description="Championship season year (0 for demo)"),
    event: str = Path(..., min_length=1, max_length=100),
    session_type: str = Path(..., min_length=1, max_length=10),
) -> SessionDetailResponse:
    try:
        proc = await get_processed_session(year, event, session_type)
    except TelemetryDataUnavailableError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load session: {exc}") from exc

    if not proc.circuit.x:
        raise HTTPException(status_code=404, detail="No telemetry available to build circuit map")

    return SessionDetailResponse(
        info=proc.info, drivers=proc.drivers, circuit=proc.circuit,
        min_race_time=proc.replay_data.min_time, max_race_time=proc.replay_data.max_time,
    )
