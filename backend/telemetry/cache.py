"""Caches fully-processed ReplayData to disk (pickle) so repeated requests skip
FastF1 loading + interpolation entirely.
"""
from __future__ import annotations

import logging
import os
import pickle

from config import get_settings
from telemetry.models import ProcessedSession, ReplayData

logger = logging.getLogger(__name__)


def _get_cache_dir() -> str:
    settings = get_settings()
    return os.path.join(settings.fastf1_cache_dir, "replay")


def _cache_path(year: int, event: str, session_type: str) -> str:
    cache_dir = _get_cache_dir()
    os.makedirs(cache_dir, exist_ok=True)
    safe_event = event.replace(" ", "_").replace("/", "_")
    return os.path.join(cache_dir, f"{year}_{safe_event}_{session_type}.pkl")


def load_cached_session(year: int, event: str, session_type: str) -> ProcessedSession | None:
    """Load a full ProcessedSession from disk cache if present."""
    path = _cache_path(year, event, session_type)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            data = pickle.load(f)
        if isinstance(data, ProcessedSession):
            logger.info("Loaded cached ProcessedSession from %s", path)
            return data
        elif isinstance(data, ReplayData):
            # Legacy cache containing ReplayData only
            return None
        return None
    except Exception as exc:
        logger.warning("Failed to read replay session cache %s: %s", path, exc)
        return None


def save_cached_session(year: int, event: str, session_type: str, session_data: ProcessedSession) -> None:
    """Save a full ProcessedSession to disk cache."""
    path = _cache_path(year, event, session_type)
    try:
        with open(path, "wb") as f:
            pickle.dump(session_data, f, protocol=pickle.HIGHEST_PROTOCOL)
        logger.info("Cached ProcessedSession to %s", path)
    except Exception as exc:
        logger.warning("Failed to write replay session cache %s: %s", path, exc)


def load_cached(year: int, event: str, session_type: str) -> ReplayData | None:
    """Legacy helper returning ReplayData from disk cache if present."""
    proc = load_cached_session(year, event, session_type)
    return proc.replay_data if proc else None


def save_cache(year: int, event: str, session_type: str, data: ReplayData) -> None:
    """Legacy helper for saving standalone ReplayData."""
    path = _cache_path(year, event, session_type)
    try:
        with open(path, "wb") as f:
            pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
        logger.info("Cached legacy replay data to %s", path)
    except Exception as exc:
        logger.warning("Failed to write legacy replay cache %s: %s", path, exc)
