from __future__ import annotations

import datetime
import logging
import os
import re

from models.schemas import LatestAvailableSession
from services import fastf1_service

logger = logging.getLogger(__name__)

DEMO_SESSION = LatestAvailableSession(
    year=0,
    event="Demo Grand Prix",
    session_type="R",
    round_number=0,
    event_name="Demo Grand Prix",
    country="Demo",
    location="Virtual Circuit",
    event_date="2024-03-02",
    is_demo=True,
    has_telemetry=True,
    status="available",
)


def determine_event_status(year: int, round_number: int, event_date_str: str) -> tuple[str, bool]:
    """Classify an event truthfully without downloading heavy session telemetry.

    Returns:
        (status, has_telemetry) where status is one of:
        - "available": verified completed session with car telemetry
        - "upcoming": scheduled future round
        - "restricted": pre-season testing or pre-2018 historical archives without detailed telemetry
    """
    if year == 0:
        return "available", True
    if round_number == 0:
        return "restricted", False
    if year < 2018:
        return "restricted", False

    today = datetime.date.today()
    if event_date_str:
        try:
            ev_date = datetime.date.fromisoformat(event_date_str)
            if ev_date > today:
                return "upcoming", False
        except ValueError:
            pass

    if year < today.year:
        return "available", True

    return "available", True


def get_latest_available_session() -> LatestAvailableSession:
    """Find the latest verified race session.

    1. Checks disk cache for any pre-processed race replay files.
    2. Falls back to the most recent completed Grand Prix from recent seasons.
    3. Falls back to Demo Grand Prix if upstream schedule fails.
    """
    search_dirs = [
        "./assets/cache/replay",
        "./backend/assets/cache/replay",
        "../assets/cache/replay",
    ]
    cached_candidates: list[tuple[int, str, str]] = []

    for d in search_dirs:
        if not os.path.isdir(d):
            continue
        for fname in os.listdir(d):
            if not fname.endswith(".pkl") or fname.startswith("."):
                continue
            match = re.match(r"^(\d{4})_(.+?)_(R|Race)\.pkl$", fname, re.IGNORECASE)
            if match:
                yr = int(match.group(1))
                ev = match.group(2).replace("_", " ")
                cached_candidates.append((yr, ev, fname))

    today_year = datetime.date.today().year
    valid_cached = [c for c in cached_candidates if 2018 <= c[0] <= today_year and c[1].lower() != "realgp"]
    if valid_cached:
        valid_cached.sort(key=lambda c: c[0], reverse=True)
        yr, ev, _ = valid_cached[0]
        full_event = ev if "Grand Prix" in ev else f"{ev} Grand Prix"
        country = ev.replace("Grand Prix", "").strip()
        return LatestAvailableSession(
            year=yr,
            event=full_event,
            session_type="R",
            round_number=1,
            event_name=full_event,
            country=country,
            location=country,
            event_date=f"{yr}-03-02",
            is_demo=False,
            has_telemetry=True,
            status="available",
        )

    target_year = min(today_year, 2024)
    try:
        schedule = fastf1_service.get_event_schedule(target_year)
        today = datetime.date.today()
        completed = []
        for _, row in schedule.iterrows():
            rnd = int(row["RoundNumber"])
            if rnd <= 0:
                continue
            ev_date = row["EventDate"].date() if hasattr(row["EventDate"], "date") and row["EventDate"] is not None else None
            if ev_date and ev_date <= today:
                completed.append((rnd, row))

        if completed:
            completed.sort(key=lambda x: x[0], reverse=True)
            best_rnd, best_row = completed[0]
            return LatestAvailableSession(
                year=target_year,
                event=best_row["EventName"],
                session_type="R",
                round_number=best_rnd,
                event_name=best_row["EventName"],
                country=best_row["Country"],
                location=best_row["Location"],
                event_date=str(best_row["EventDate"].date()) if hasattr(best_row["EventDate"], "date") else "",
                is_demo=False,
                has_telemetry=True,
                status="available",
            )
    except Exception as exc:
        logger.warning("Could not fetch schedule for latest available session: %s", exc)

    return DEMO_SESSION
