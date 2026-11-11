"""Caches fully-processed ReplayData to disk (pickle) so repeated requests skip
FastF1 loading + interpolation entirely.
"""
from __future__ import annotations

import contextlib
import logging
import os
import pickle

from config import get_settings
from telemetry.models import ProcessedSession, ReplayData

logger = logging.getLogger(__name__)


SESSION_TYPE_ALIASES = {
    "r": "R",
    "race": "R",
    "q": "Q",
    "qualifying": "Q",
    "s": "S",
    "sprint": "S",
    "sq": "SS",
    "sprint qualifying": "SS",
    "sprint shootout": "SS",
    "fp1": "FP1",
    "practice 1": "FP1",
    "fp2": "FP2",
    "practice 2": "FP2",
    "fp3": "FP3",
    "practice 3": "FP3",
}


def canonical_session_key(year: int, event: str, session_type: str) -> tuple[int, str, str]:
    """Normalize session key components (strip whitespace, resolve session type aliases)."""
    norm_year = int(year)
    norm_event = event.strip()
    norm_session = SESSION_TYPE_ALIASES.get(session_type.strip().lower(), session_type.strip().upper())
    return (norm_year, norm_event, norm_session)


def _configured_cache_base_dir() -> tuple[str, bool]:
    """Return (base_cache_dir, is_explicit_override)."""
    env_override = os.environ.get("FASTF1_CACHE_DIR")
    if env_override and env_override.strip():
        return env_override.strip(), True
    settings = get_settings()
    return settings.fastf1_cache_dir, settings.fastf1_cache_dir != "./assets/cache"


def _get_cache_dir() -> str:
    base_dir, _ = _configured_cache_base_dir()
    return os.path.join(base_dir, "replay")


def get_replay_cache_dirs() -> list[str]:
    """Return replay cache directories, strictly honouring FASTF1_CACHE_DIR overrides."""
    base_dir, is_override = _configured_cache_base_dir()
    primary = os.path.abspath(os.path.join(base_dir, "replay"))
    search_dirs = [primary] if os.path.isdir(primary) else []

    if not is_override:
        for fallback_root in ["./assets/cache/replay", "./backend/assets/cache/replay", "../assets/cache/replay"]:
            abs_fallback = os.path.abspath(fallback_root)
            if abs_fallback not in search_dirs and os.path.isdir(abs_fallback):
                search_dirs.append(abs_fallback)
    return search_dirs


def _cache_path(year: int, event: str, session_type: str) -> str:
    year, event, session_type = canonical_session_key(year, event, session_type)
    cache_dir = _get_cache_dir()
    os.makedirs(cache_dir, exist_ok=True)
    safe_event = event.replace(" ", "_").replace("/", "_")
    return os.path.join(cache_dir, f"{year}_{safe_event}_{session_type}.pkl")


def is_valid_processed_session(data: object) -> bool:
    """Verify object type, metadata, circuit geometry, drivers, and non-empty frames."""
    if not isinstance(data, ProcessedSession):
        return False
    info = getattr(data, "info", None)
    if info is None or not isinstance(info.year, int) or info.year < 0:
        return False
    if not info.event or not info.event.strip():
        return False
    if not info.session_type or not info.session_type.strip():
        return False
    circuit = getattr(data, "circuit", None)
    if circuit is None or not circuit.x or not circuit.y or len(circuit.x) != len(circuit.y):
        return False
    if not getattr(data, "drivers", None):
        return False
    replay_data = getattr(data, "replay_data", None)
    if replay_data is None or not replay_data.frames:
        return False
    return True


def _candidate_filenames(canon_year: int, canon_event: str, canon_session: str) -> list[str]:
    safe_event = canon_event.replace(" ", "_").replace("/", "_")
    candidate_names = [f"{canon_year}_{safe_event}_{canon_session}.pkl"]
    if canon_session == "R":
        candidate_names.append(f"{canon_year}_{safe_event}_Race.pkl")
    elif canon_session == "Q":
        candidate_names.append(f"{canon_year}_{safe_event}_Qualifying.pkl")
    elif canon_session == "S":
        candidate_names.append(f"{canon_year}_{safe_event}_Sprint.pkl")
    elif canon_session == "SS":
        candidate_names.append(f"{canon_year}_{safe_event}_Sprint_Qualifying.pkl")

    # Also handle events with/without "_Grand_Prix" suffix
    if safe_event.endswith("_Grand_Prix"):
        short_event = safe_event[:-11]
        candidate_names.append(f"{canon_year}_{short_event}_{canon_session}.pkl")
        if canon_session == "R":
            candidate_names.append(f"{canon_year}_{short_event}_Race.pkl")
        elif canon_session == "Q":
            candidate_names.append(f"{canon_year}_{short_event}_Qualifying.pkl")
        elif canon_session == "S":
            candidate_names.append(f"{canon_year}_{short_event}_Sprint.pkl")
    else:
        candidate_names.append(f"{canon_year}_{safe_event}_Grand_Prix_{canon_session}.pkl")
        if canon_session == "R":
            candidate_names.append(f"{canon_year}_{safe_event}_Grand_Prix_Race.pkl")
    return candidate_names


def find_cached_session_path(year: int, event: str, session_type: str) -> str | None:
    """Locate a cached replay pickle file matching (year, event, session_type) across cache dirs."""
    canon_year, canon_event, canon_session = canonical_session_key(year, event, session_type)
    candidate_names = _candidate_filenames(canon_year, canon_event, canon_session)
    for d in get_replay_cache_dirs():
        for name in candidate_names:
            candidate_path = os.path.join(d, name)
            if os.path.isfile(candidate_path):
                return candidate_path
    return None


def inspect_cached_session_file(path: str) -> tuple[ProcessedSession | None, bool]:
    """Read and validate a cached replay file without mutating/deleting on disk.

    Returns:
        (processed_session_or_none, is_corrupted_or_unusable)
    """
    if not path or not os.path.isfile(path):
        return None, False
    try:
        with open(path, "rb") as f:
            data = pickle.load(f)
    except Exception as exc:
        logger.warning("Failed to inspect replay cache %s: %s", path, exc)
        return None, True

    if is_valid_processed_session(data):
        return data, False
    return None, True


def load_cached_session(year: int, event: str, session_type: str) -> ProcessedSession | None:
    """Load a full ProcessedSession from disk cache if present."""
    path = find_cached_session_path(year, event, session_type)
    if not path or not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            data = pickle.load(f)
        if is_valid_processed_session(data):
            logger.info("Loaded cached ProcessedSession from %s", path)
            return data
        if isinstance(data, ProcessedSession):
            logger.warning("Found corrupted or empty ProcessedSession in disk cache at %s. Discarding.", path)
            with contextlib.suppress(OSError):
                os.remove(path)
            return None
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
