import logging
import os
import fastf1
from functools import lru_cache

from config import get_settings

logger = logging.getLogger(__name__)
_cache_initialized = False


def init_cache() -> None:
    global _cache_initialized
    if _cache_initialized:
        return
    settings = get_settings()
    os.makedirs(settings.fastf1_cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(settings.fastf1_cache_dir)
    _cache_initialized = True
    logger.info("FastF1 cache enabled at %s", settings.fastf1_cache_dir)


def get_event_schedule(year: int):
    init_cache()
    return fastf1.get_event_schedule(year, include_testing=False)


@lru_cache(maxsize=16)
def _load_session_cached(year: int, event: str, session_type: str):
    init_cache()
    logger.info("Loading FastF1 session %s %s %s", year, event, session_type)
    session = fastf1.get_session(year, event, session_type)
    session.load(telemetry=True, weather=True, laps=True)
    return session


def get_session(year: int, event: str, session_type: str):
    """Load (and cache in-process) a FastF1 session object."""
    return _load_session_cached(year, event, session_type)
