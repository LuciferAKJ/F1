"""Ties together session loading, raw telemetry extraction, processing, and caching."""
from __future__ import annotations

import logging

from services import fastf1_service
from telemetry.cache import load_cached, save_cache
from telemetry.loader import load_driver_raw_telemetry
from telemetry.models import ReplayData
from telemetry.processor import build_replay_frames

logger = logging.getLogger(__name__)


def get_replay_data(year: int, event: str, session_type: str) -> ReplayData:
    """Return processed ReplayData, using the on-disk cache when available."""
    cached = load_cached(year, event, session_type)
    if cached is not None:
        return cached

    session = fastf1_service.get_session(year, event, session_type)
    drivers = [session.get_driver(d)["Abbreviation"] for d in session.drivers]

    raw = load_driver_raw_telemetry(session, drivers)
    replay_data = build_replay_frames(raw)

    save_cache(year, event, session_type, replay_data)
    return replay_data
