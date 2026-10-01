import logging
from fastapi import APIRouter, HTTPException, Path
import pandas as pd

from services import fastf1_service
from services.session_overview_service import build_session_overview
from models.schemas import SeasonEvent, SessionDetailResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{year}/events", response_model=list[SeasonEvent])
def list_events(year: int = Path(..., ge=1950, le=2050, description="Championship season year")) -> list[SeasonEvent]:
    try:
        schedule = fastf1_service.get_event_schedule(year)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to load schedule: {exc}") from exc

    events: list[SeasonEvent] = []
    for _, row in schedule.iterrows():
        events.append(SeasonEvent(
            round_number=int(row["RoundNumber"]),
            event_name=row["EventName"],
            country=row["Country"],
            location=row["Location"],
            event_date=str(row["EventDate"].date()) if pd.notna(row["EventDate"]) else "",
        ))
    return events


@router.get("/{year}/{event}/{session_type}", response_model=SessionDetailResponse)
def get_session_detail(
    year: int = Path(..., ge=1950, le=2050, description="Championship season year"),
    event: str = Path(..., min_length=1, max_length=100),
    session_type: str = Path(..., min_length=1, max_length=10),
) -> SessionDetailResponse:
    try:
        session = fastf1_service.get_session(year, event, session_type)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to load session: {exc}") from exc

    info, drivers, circuit = build_session_overview(session, year, event, session_type)
    if not circuit.x:
        raise HTTPException(status_code=404, detail="No telemetry available to build circuit map")

    laps = session.laps
    starts = laps["LapStartTime"].dropna()
    min_t = float(starts.min().total_seconds()) if not starts.empty else 0.0
    ends = (laps["LapStartTime"] + laps["LapTime"]).dropna()
    max_t = float(ends.max().total_seconds()) if not ends.empty else min_t

    return SessionDetailResponse(
        info=info, drivers=drivers, circuit=circuit,
        min_race_time=min_t, max_race_time=max_t,
    )
