from __future__ import annotations

import datetime
import logging
import os
import re
from dataclasses import dataclass
from typing import Any

import pandas as pd

from models.schemas import (
    AvailabilityStatus,
    CircuitData,
    LatestAvailableSession,
    SeasonEvent,
    SessionAvailabilityResponse,
)
from services import fastf1_service
from telemetry.cache import (
    canonical_session_key,
    find_cached_session_path,
    get_replay_cache_dirs,
    inspect_cached_session_file,
    is_valid_processed_session,
)
from telemetry.demo_data import get_demo_session
from telemetry.exceptions import TelemetryDataUnavailableError
from telemetry.models import ProcessedSession

logger = logging.getLogger(__name__)

SUPPORTED_SESSION_TYPES = {"R", "Q", "S", "SS", "FP1", "FP2", "FP3"}
SESSION_PRIORITY = {"R": 7, "S": 6, "Q": 5, "SS": 4, "FP3": 3, "FP2": 2, "FP1": 1}

SESSION_NAME_TO_CODE = {
    "race": "R",
    "qualifying": "Q",
    "sprint": "S",
    "sprint qualifying": "SS",
    "sprint shootout": "SS",
    "practice 1": "FP1",
    "practice 2": "FP2",
    "practice 3": "FP3",
}


@dataclass(frozen=True)
class VerifiedCacheMeta:
    year: int
    event: str
    session_type: str
    total_laps: int | None
    driver_count: int
    circuit: CircuitData
    filepath: str


# Memoize validated cache file inspections keyed by (abspath, mtime_ns, size)
_file_meta_cache: dict[tuple[str, int, int], VerifiedCacheMeta | None] = {}


def clear_availability_cache() -> None:
    """Clear in-memory availability inspection cache (useful in tests)."""
    _file_meta_cache.clear()


def _downsample_circuit(circuit: CircuitData, max_points: int = 300) -> CircuitData:
    """Reduce coordinate density for lightweight landing previews while preserving bounds."""
    n = len(circuit.x)
    if n <= max_points or n == 0:
        return circuit
    step = max(1, n // max_points)
    xs = circuit.x[::step]
    ys = circuit.y[::step]
    if xs[-1] != circuit.x[-1] or ys[-1] != circuit.y[-1]:
        xs.append(circuit.x[-1])
        ys.append(circuit.y[-1])
    return CircuitData(
        x=xs,
        y=ys,
        min_x=circuit.min_x,
        max_x=circuit.max_x,
        min_y=circuit.min_y,
        max_y=circuit.max_y,
    )


def _extract_meta(proc: ProcessedSession, filepath: str) -> VerifiedCacheMeta:
    canon_year, canon_event, canon_session = canonical_session_key(
        proc.info.year, proc.info.event, proc.info.session_type
    )
    return VerifiedCacheMeta(
        year=canon_year,
        event=canon_event,
        session_type=canon_session,
        total_laps=proc.info.total_laps,
        driver_count=len(proc.drivers),
        circuit=_downsample_circuit(proc.circuit),
        filepath=filepath,
    )


def _inspect_file_memoized(filepath: str) -> tuple[VerifiedCacheMeta | None, bool]:
    """Return (VerifiedCacheMeta_or_None, is_corrupt_or_invalid) using mtime/size memoization."""
    try:
        st = os.stat(filepath)
    except OSError:
        return None, False

    cache_key = (os.path.abspath(filepath), st.st_mtime_ns, st.st_size)
    if cache_key in _file_meta_cache:
        meta = _file_meta_cache[cache_key]
        return meta, meta is None

    proc, is_corrupt = inspect_cached_session_file(filepath)
    if proc is not None and not is_corrupt:
        meta = _extract_meta(proc, filepath)
        _file_meta_cache[cache_key] = meta
        return meta, False

    _file_meta_cache[cache_key] = None
    return None, True


def _get_verified_cache_entries() -> list[VerifiedCacheMeta]:
    """Scan configured replay cache directories and return validated session metadata."""
    entries: list[VerifiedCacheMeta] = []
    seen_keys: set[tuple[int, str, str]] = set()

    for cache_dir in get_replay_cache_dirs():
        try:
            filenames = sorted(os.listdir(cache_dir))
        except OSError:
            continue
        for fname in filenames:
            if not fname.endswith(".pkl") or fname.startswith("."):
                continue
            fpath = os.path.join(cache_dir, fname)
            if not os.path.isfile(fpath):
                continue
            meta, _ = _inspect_file_memoized(fpath)
            if meta is None:
                continue
            key = (meta.year, _normalize_event_name(meta.event), meta.session_type)
            if key not in seen_keys:
                seen_keys.add(key)
                entries.append(meta)
    return entries


def _normalize_event_name(name: str) -> str:
    cleaned = re.sub(r"[_\-]+", " ", name.strip().lower())
    cleaned = re.sub(r"\s+grand\s+prix$", "", cleaned)
    cleaned = re.sub(r"\s+gp$", "", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _events_match(a: str, b: str) -> bool:
    if a.strip().lower() == b.strip().lower():
        return True
    norm_a = _normalize_event_name(a)
    norm_b = _normalize_event_name(b)
    return bool(norm_a and norm_a == norm_b)


def _match_event_row(schedule: pd.DataFrame, target_event: str) -> pd.Series | None:
    """Resolve an event string against an official FastF1 season schedule."""
    if schedule is None or schedule.empty or not target_event:
        return None

    target_lower = target_event.strip().lower()
    target_norm = _normalize_event_name(target_event)

    # Pass 1: exact EventName match
    for _, row in schedule.iterrows():
        ev_name = str(row.get("EventName", "")).strip()
        if ev_name.lower() == target_lower:
            return row

    # Pass 2: normalized EventName match (with/without "Grand Prix")
    for _, row in schedule.iterrows():
        ev_name = str(row.get("EventName", "")).strip()
        if _normalize_event_name(ev_name) == target_norm:
            return row

    # Pass 3: unique Country or Location match (championship rounds only)
    for _, row in schedule.iterrows():
        rnd = int(row.get("RoundNumber", 0))
        if rnd <= 0:
            continue
        country = str(row.get("Country", "")).strip().lower()
        location = str(row.get("Location", "")).strip().lower()
        if target_norm and (country == target_norm or location == target_norm):
            return row

    return None


def _parse_date(val: Any) -> datetime.date | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(val, "date") and callable(val.date):
        try:
            return val.date()
        except Exception:
            pass
    if isinstance(val, datetime.date):
        return val
    try:
        return datetime.date.fromisoformat(str(val)[:10])
    except ValueError:
        return None


def _extract_row_sessions(row: pd.Series) -> dict[str, datetime.date | None] | None:
    """Extract map of {session_code: session_date} if Session1..5 exist in schedule row."""
    session_map: dict[str, datetime.date | None] = {}
    found_any_col = False
    for idx in range(1, 6):
        col = f"Session{idx}"
        if col in row.index:
            found_any_col = True
            raw_name = row.get(col)
            if raw_name is not None and not (isinstance(raw_name, float) and pd.isna(raw_name)):
                name_str = str(raw_name).strip().lower()
                code = SESSION_NAME_TO_CODE.get(name_str)
                if code:
                    dt = _parse_date(row.get(f"Session{idx}DateUtc")) or _parse_date(row.get(f"Session{idx}Date"))
                    session_map[code] = dt
    if found_any_col and session_map:
        return session_map
    return None


def _session_exists_on_row(row: pd.Series, canon_session: str) -> tuple[bool, datetime.date | None]:
    """Determine whether canon_session exists on the schedule row and return its date if known."""
    row_sessions = _extract_row_sessions(row)
    if row_sessions is not None:
        if canon_session in row_sessions:
            return True, row_sessions[canon_session] or _parse_date(row.get("EventDate"))
        return False, None

    event_format = str(row.get("EventFormat", "")).strip().lower()
    if event_format == "conventional" and canon_session in {"S", "SS"}:
        return False, None

    return True, _parse_date(row.get("EventDate"))


def _match_verified_entry_for_row(
    entries: list[VerifiedCacheMeta], year: int, row: pd.Series, canon_session: str
) -> VerifiedCacheMeta | None:
    ev_name = str(row.get("EventName", "")).strip()
    country = str(row.get("Country", "")).strip()
    location = str(row.get("Location", "")).strip()
    for entry in entries:
        if entry.year != year or entry.session_type != canon_session:
            continue
        if _events_match(entry.event, ev_name) or (
            int(row.get("RoundNumber", 0)) > 0
            and (_events_match(entry.event, country) or _events_match(entry.event, location))
        ):
            return entry
    return None


def _verified_sessions_for_row(entries: list[VerifiedCacheMeta], year: int, row: pd.Series) -> list[str]:
    ev_name = str(row.get("EventName", "")).strip()
    country = str(row.get("Country", "")).strip()
    location = str(row.get("Location", "")).strip()
    codes: list[str] = []
    for entry in entries:
        if entry.year != year:
            continue
        if _events_match(entry.event, ev_name) or (
            int(row.get("RoundNumber", 0)) > 0
            and (_events_match(entry.event, country) or _events_match(entry.event, location))
        ):
            if entry.session_type not in codes:
                codes.append(entry.session_type)
    return sorted(codes, key=lambda c: SESSION_PRIORITY.get(c, 0), reverse=True)


def _check_corrupt_cache_for_row(year: int, row: pd.Series, canon_session: str) -> bool:
    """Check if an explicit cache file exists for this event/session and is invalid/corrupted."""
    ev_name = str(row.get("EventName", "")).strip()
    country = str(row.get("Country", "")).strip()
    for candidate_ev in [ev_name, country]:
        if not candidate_ev:
            continue
        fpath = find_cached_session_path(year, candidate_ev, canon_session)
        if fpath:
            _, is_corrupt = _inspect_file_memoized(fpath)
            if is_corrupt:
                return True
    return False


def evaluate_event_session(
    year: int,
    row: pd.Series,
    session_type: str,
    cached_entries: list[VerifiedCacheMeta],
    today: datetime.date | None = None,
) -> SeasonEvent:
    """Evaluate honest availability for one schedule event row and requested session type."""
    _, _, canon_session = canonical_session_key(year, str(row.get("EventName", "")), session_type)
    round_num = int(row.get("RoundNumber", 0))
    ev_name = str(row.get("EventName", "")).strip()
    country = str(row.get("Country", "")).strip()
    location = str(row.get("Location", "")).strip()
    ev_date_obj = _parse_date(row.get("EventDate"))
    ev_date_str = ev_date_obj.isoformat() if ev_date_obj else ""
    today_date = today or datetime.date.today()

    session_supported = canon_session in SUPPORTED_SESSION_TYPES
    session_exists, session_date_obj = _session_exists_on_row(row, canon_session)
    effective_date = session_date_obj or ev_date_obj
    has_occurred = bool(effective_date is not None and effective_date <= today_date)

    f1_api_support = row.get("F1ApiSupport")
    api_restricted = f1_api_support is False or str(f1_api_support).lower() == "false"

    verified_sessions = _verified_sessions_for_row(cached_entries, year, row)
    matched_entry = _match_verified_entry_for_row(cached_entries, year, row, canon_session)

    status: AvailabilityStatus = "unknown"
    has_telemetry = False
    verified = False
    circuit: CircuitData | None = None
    total_laps: int | None = None
    driver_count: int | None = None
    status_reason: str | None = None

    if not session_supported:
        status = "unavailable"
        status_reason = f"Session type '{canon_session}' is not supported."
    elif round_num == 0 or year < 2018 or api_restricted:
        status = "restricted"
        status_reason = (
            "Pre-season testing does not include full race replay telemetry."
            if round_num == 0
            else "FastF1 detailed car telemetry archive begins in the 2018 season."
        )
    elif not session_exists:
        status = "unavailable"
        status_reason = f"{ev_name} does not include a {canon_session} session."
    elif matched_entry is not None:
        status = "available"
        has_telemetry = True
        verified = True
        circuit = matched_entry.circuit
        total_laps = matched_entry.total_laps
        driver_count = matched_entry.driver_count
        status_reason = "Processed replay verified and ready."
    elif _check_corrupt_cache_for_row(year, row, canon_session):
        status = "unavailable"
        status_reason = "Cached replay data is corrupted or incomplete."
    elif effective_date is None:
        status = "unknown"
        status_reason = "Session schedule date could not be determined."
    elif not has_occurred:
        status = "upcoming"
        status_reason = f"Scheduled for {effective_date.isoformat()}."
    else:
        status = "unverified"
        status_reason = "Session has concluded, but replay telemetry has not been verified yet."

    return SeasonEvent(
        round_number=round_num,
        event_name=ev_name,
        country=country,
        location=location,
        event_date=ev_date_str,
        session_type=canon_session,
        status=status,
        has_telemetry=has_telemetry,
        event_exists=True,
        has_occurred=has_occurred,
        session_exists=session_exists,
        session_supported=session_supported,
        verified=verified,
        verified_sessions=verified_sessions,
        total_laps=total_laps,
        driver_count=driver_count,
        circuit=circuit,
        status_reason=status_reason,
    )


def get_demo_latest_session(status_reason: str | None = None) -> LatestAvailableSession:
    """Return Demo Grand Prix explicitly marked as sample telemetry."""
    demo_proc = get_demo_session()
    return LatestAvailableSession(
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
        verified=True,
        has_verified_real_session=False,
        status="available",
        total_laps=demo_proc.info.total_laps,
        driver_count=len(demo_proc.drivers),
        circuit=_downsample_circuit(demo_proc.circuit),
        status_reason=status_reason or "No verified Grand Prix replay is currently cached; showing sample Demo telemetry.",
    )


def get_season_events_with_availability(
    year: int, session_type: str = "R", today: datetime.date | None = None
) -> list[SeasonEvent]:
    """Return season events enriched with honest per-session availability."""
    if year == 0:
        demo_proc = get_demo_session()
        return [
            SeasonEvent(
                round_number=0,
                event_name="Demo Grand Prix",
                country="Demo",
                location="Virtual Circuit",
                event_date="2024-03-02",
                session_type="R",
                status="available",
                has_telemetry=True,
                event_exists=True,
                has_occurred=True,
                session_exists=True,
                session_supported=True,
                verified=True,
                verified_sessions=["R"],
                total_laps=demo_proc.info.total_laps,
                driver_count=len(demo_proc.drivers),
                circuit=_downsample_circuit(demo_proc.circuit),
                status_reason="Built-in sample replay telemetry.",
            )
        ]

    schedule = fastf1_service.get_event_schedule(year)
    entries = _get_verified_cache_entries()
    events: list[SeasonEvent] = []
    for _, row in schedule.iterrows():
        events.append(evaluate_event_session(year, row, session_type, entries, today=today))
    return events


def get_latest_available_session(today: datetime.date | None = None) -> LatestAvailableSession:
    """Select the latest verified cached real session resolved against actual season schedules.

    Never caps year at 2024, never guesses metadata from incomplete filenames, and never
    marks an uncached/unverified race as available. Falls back explicitly to Demo Grand Prix.
    """
    entries = _get_verified_cache_entries()
    today_date = today or datetime.date.today()
    real_entries = [e for e in entries if e.year >= 2018 and e.session_type in SUPPORTED_SESSION_TYPES]

    if not real_entries:
        return get_demo_latest_session()

    years_to_check = sorted({e.year for e in real_entries}, reverse=True)
    schedules_by_year: dict[int, pd.DataFrame | None] = {}
    for yr in years_to_check:
        try:
            schedules_by_year[yr] = fastf1_service.get_event_schedule(yr)
        except Exception as exc:
            logger.warning("Could not load season %s schedule for availability resolution: %s", yr, exc)
            schedules_by_year[yr] = None

    resolved_candidates: list[tuple[tuple[str, int, int, int], LatestAvailableSession]] = []

    for entry in real_entries:
        sched = schedules_by_year.get(entry.year)
        if sched is None or sched.empty:
            continue
        matched_row = _match_event_row(sched, entry.event)
        if matched_row is None:
            continue
        evaluated = evaluate_event_session(entry.year, matched_row, entry.session_type, [entry], today=today_date)
        if evaluated.status != "available" or evaluated.round_number <= 0:
            continue

        sort_key = (
            evaluated.event_date or f"{entry.year:04d}-00-00",
            entry.year,
            evaluated.round_number,
            SESSION_PRIORITY.get(entry.session_type, 0),
        )
        session_dto = LatestAvailableSession(
            year=entry.year,
            event=evaluated.event_name,
            session_type=entry.session_type,
            round_number=evaluated.round_number,
            event_name=evaluated.event_name,
            country=evaluated.country,
            location=evaluated.location,
            event_date=evaluated.event_date,
            is_demo=False,
            has_telemetry=True,
            verified=True,
            has_verified_real_session=True,
            status="available",
            total_laps=entry.total_laps,
            driver_count=entry.driver_count,
            circuit=entry.circuit,
            status_reason="Verified replay telemetry cached and ready.",
        )
        resolved_candidates.append((sort_key, session_dto))

    if resolved_candidates:
        resolved_candidates.sort(key=lambda item: item[0], reverse=True)
        return resolved_candidates[0][1]

    return get_demo_latest_session(
        status_reason="No verified Grand Prix replay resolved against season schedules; showing sample Demo telemetry."
    )


async def check_session_availability(
    year: int,
    event: str,
    session_type: str,
    verify: bool = False,
    today: datetime.date | None = None,
) -> SessionAvailabilityResponse:
    """Check (and optionally verify on-demand) availability for a single specific session."""
    canon_year, canon_event, canon_session = canonical_session_key(year, event, session_type)

    if canon_year == 0 or canon_event.lower() == "demo grand prix":
        demo = get_demo_latest_session()
        return SessionAvailabilityResponse(
            year=0,
            event=demo.event_name,
            session_type="R",
            round_number=0,
            event_name=demo.event_name,
            country=demo.country,
            location=demo.location,
            event_date=demo.event_date,
            status="available",
            has_telemetry=True,
            event_exists=True,
            has_occurred=True,
            session_exists=True,
            session_supported=True,
            verified=True,
            is_demo=True,
            total_laps=demo.total_laps,
            driver_count=demo.driver_count,
            circuit=demo.circuit,
            status_reason="Built-in sample replay telemetry.",
        )

    session_supported = canon_session in SUPPORTED_SESSION_TYPES
    try:
        schedule = fastf1_service.get_event_schedule(canon_year)
    except Exception as exc:
        logger.warning("Failed to fetch schedule for %s during availability check: %s", canon_year, exc)
        return SessionAvailabilityResponse(
            year=canon_year,
            event=canon_event,
            session_type=canon_session,
            status="unknown",
            has_telemetry=False,
            event_exists=False,
            has_occurred=False,
            session_exists=False,
            session_supported=session_supported,
            verified=False,
            status_reason=f"Could not fetch {canon_year} schedule: {exc}",
        )

    row = _match_event_row(schedule, canon_event)
    if row is None:
        return SessionAvailabilityResponse(
            year=canon_year,
            event=canon_event,
            session_type=canon_session,
            status="unavailable",
            has_telemetry=False,
            event_exists=False,
            has_occurred=False,
            session_exists=False,
            session_supported=session_supported,
            verified=False,
            status_reason=f"Event '{canon_event}' was not found in the {canon_year} schedule.",
        )

    entries = _get_verified_cache_entries()
    evaluated = evaluate_event_session(canon_year, row, canon_session, entries, today=today)

    # If user explicitly requested verification on an eligible completed session
    if verify and evaluated.status in {"unverified", "unavailable"} and (
        evaluated.event_exists
        and evaluated.has_occurred
        and evaluated.session_exists
        and evaluated.session_supported
        and evaluated.round_number > 0
    ):
        from telemetry.pipeline import get_processed_session

        try:
            proc = await get_processed_session(canon_year, evaluated.event_name, canon_session)
            if is_valid_processed_session(proc):
                return SessionAvailabilityResponse(
                    year=canon_year,
                    event=evaluated.event_name,
                    session_type=canon_session,
                    round_number=evaluated.round_number,
                    event_name=evaluated.event_name,
                    country=evaluated.country,
                    location=evaluated.location,
                    event_date=evaluated.event_date,
                    status="available",
                    has_telemetry=True,
                    event_exists=True,
                    has_occurred=True,
                    session_exists=True,
                    session_supported=True,
                    verified=True,
                    is_demo=False,
                    total_laps=proc.info.total_laps,
                    driver_count=len(proc.drivers),
                    circuit=_downsample_circuit(proc.circuit),
                    status_reason="Processed replay verified and ready.",
                )
            return SessionAvailabilityResponse(
                year=canon_year,
                event=evaluated.event_name,
                session_type=canon_session,
                round_number=evaluated.round_number,
                event_name=evaluated.event_name,
                country=evaluated.country,
                location=evaluated.location,
                event_date=evaluated.event_date,
                status="unavailable",
                has_telemetry=False,
                event_exists=True,
                has_occurred=True,
                session_exists=True,
                session_supported=True,
                verified=False,
                status_reason="Telemetry was incomplete and could not produce a valid replay.",
            )
        except TelemetryDataUnavailableError as exc:
            return SessionAvailabilityResponse(
                year=canon_year,
                event=evaluated.event_name,
                session_type=canon_session,
                round_number=evaluated.round_number,
                event_name=evaluated.event_name,
                country=evaluated.country,
                location=evaluated.location,
                event_date=evaluated.event_date,
                status="unavailable",
                has_telemetry=False,
                event_exists=True,
                has_occurred=True,
                session_exists=True,
                session_supported=True,
                verified=False,
                status_reason=str(exc),
            )
        except Exception as exc:
            logger.warning("On-demand verification failed for %s %s %s: %s", canon_year, evaluated.event_name, canon_session, exc)
            return SessionAvailabilityResponse(
                year=canon_year,
                event=evaluated.event_name,
                session_type=canon_session,
                round_number=evaluated.round_number,
                event_name=evaluated.event_name,
                country=evaluated.country,
                location=evaluated.location,
                event_date=evaluated.event_date,
                status="unknown",
                has_telemetry=False,
                event_exists=True,
                has_occurred=True,
                session_exists=True,
                session_supported=True,
                verified=False,
                status_reason=f"Availability check failed: {exc}",
            )

    return SessionAvailabilityResponse(
        year=canon_year,
        event=evaluated.event_name,
        session_type=canon_session,
        round_number=evaluated.round_number,
        event_name=evaluated.event_name,
        country=evaluated.country,
        location=evaluated.location,
        event_date=evaluated.event_date,
        status=evaluated.status,
        has_telemetry=evaluated.has_telemetry,
        event_exists=evaluated.event_exists,
        has_occurred=evaluated.has_occurred,
        session_exists=evaluated.session_exists,
        session_supported=evaluated.session_supported,
        verified=evaluated.verified,
        is_demo=False,
        total_laps=evaluated.total_laps,
        driver_count=evaluated.driver_count,
        circuit=evaluated.circuit,
        status_reason=evaluated.status_reason,
    )
