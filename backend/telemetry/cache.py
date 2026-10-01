"""Caches fully-processed ReplayData to disk (pickle) so repeated requests skip
FastF1 loading + interpolation entirely.
"""
from __future__ import annotations
import logging
import os
import pickle

from telemetry.models import ReplayData

logger = logging.getLogger(__name__)
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "cache", "replay")


def _cache_path(year: int, event: str, session_type: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    safe_event = event.replace(" ", "_").replace("/", "_")
    return os.path.join(CACHE_DIR, f"{year}_{safe_event}_{session_type}.pkl")


def load_cached(year: int, event: str, session_type: str) -> ReplayData | None:
    path = _cache_path(year, event, session_type)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            data = pickle.load(f)
        logger.info("Loaded cached replay data from %s", path)
        return data
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to read replay cache %s: %s", path, exc)
        return None


def save_cache(year: int, event: str, session_type: str, data: ReplayData) -> None:
    path = _cache_path(year, event, session_type)
    try:
        with open(path, "wb") as f:
            pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
        logger.info("Cached replay data to %s", path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to write replay cache %s: %s", path, exc)
