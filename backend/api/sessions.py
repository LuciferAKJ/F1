import logging

import pandas as pd
from fastapi import APIRouter, HTTPException, Path

from models.schemas import SeasonEvent, SessionDetailResponse
from services import fastf1_service
from telemetry.pipeline import get_processed_session

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{year}/events", response_model=list[SeasonEvent])
def list_events(year: int = Path(..., ge=1950, le=2050, description="Championship season year")) -> list[SeasonEvent]:
    try:
        schedule = fastf1_service.get_event_schedule(year)
    except Exception as exc:
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
async def get_session_detail(
    year: int = Path(..., ge=1950, le=2050, description="Championship season year"),
    event: str = Path(..., min_length=1, max_length=100),
    session_type: str = Path(..., min_length=1, max_length=10),
) -> SessionDetailResponse:
    try:
        proc = await get_processed_session(year, event, session_type)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load session: {exc}") from exc

    if not proc.circuit.x:
        raise HTTPException(status_code=404, detail="No telemetry available to build circuit map")

    return SessionDetailResponse(
        info=proc.info, drivers=proc.drivers, circuit=proc.circuit,
        min_race_time=proc.replay_data.min_time, max_race_time=proc.replay_data.max_time,
    )
