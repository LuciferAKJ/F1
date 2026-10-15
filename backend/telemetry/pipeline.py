"""Single-flight, memory-bounded pipeline for session loading, telemetry extraction,
replay processing, and multi-tier caching (memory LRU + disk pickle).
"""
from __future__ import annotations

import asyncio
import gc
import logging
import threading
from collections import OrderedDict

from config import get_settings
from services import fastf1_service
from services.session_overview_service import build_session_overview
from telemetry.cache import load_cached_session, save_cached_session
from telemetry.loader import load_driver_raw_telemetry
from telemetry.models import ProcessedSession, ReplayData
from telemetry.processor import build_replay_frames

logger = logging.getLogger(__name__)

# In-memory LRU cache of ProcessedSession (size bounded by settings.max_cached_sessions)
_memory_cache: OrderedDict[tuple[int, str, str], ProcessedSession] = OrderedDict()
_memory_cache_lock = threading.Lock()

# Single-flight coordination for async callers
_inflight_futures: dict[tuple[int, str, str], asyncio.Future[ProcessedSession]] = {}
_inflight_lock: asyncio.Lock | None = None
_load_semaphore: asyncio.Semaphore | None = None

# Synchronous single-flight lock for thread/sync callers
_sync_load_semaphore: threading.Semaphore | None = None
_session_locks: dict[tuple[int, str, str], threading.Lock] = {}
_session_locks_guard = threading.Lock()


def _get_session_lock(key: tuple[int, str, str]) -> threading.Lock:
    with _session_locks_guard:
        if key not in _session_locks:
            _session_locks[key] = threading.Lock()
        return _session_locks[key]


def _get_async_primitives() -> tuple[asyncio.Lock, asyncio.Semaphore]:
    global _inflight_lock, _load_semaphore
    if _inflight_lock is None:
        _inflight_lock = asyncio.Lock()
    if _load_semaphore is None:
        settings = get_settings()
        _load_semaphore = asyncio.Semaphore(max(1, settings.max_concurrent_session_loads))
    return _inflight_lock, _load_semaphore


def _get_sync_semaphore() -> threading.Semaphore:
    global _sync_load_semaphore
    if _sync_load_semaphore is None:
        settings = get_settings()
        _sync_load_semaphore = threading.Semaphore(max(1, settings.max_concurrent_session_loads))
    return _sync_load_semaphore


def _cache_get(key: tuple[int, str, str]) -> ProcessedSession | None:
    with _memory_cache_lock:
        if key in _memory_cache:
            _memory_cache.move_to_end(key)
            logger.info("Memory cache hit for session %s %s %s", *key)
            return _memory_cache[key]
    return None


def _cache_put(key: tuple[int, str, str], session_data: ProcessedSession) -> None:
    settings = get_settings()
    max_sessions = getattr(settings, "max_cached_sessions", 1)
    replay_size = getattr(settings, "replay_cache_size", 1)
    if isinstance(replay_size, int) and isinstance(max_sessions, int):
        max_size = max(1, min(max_sessions, replay_size))
    elif isinstance(max_sessions, int):
        max_size = max(1, max_sessions)
    elif isinstance(replay_size, int):
        max_size = max(1, replay_size)
    else:
        max_size = 1
    with _memory_cache_lock:
        _memory_cache[key] = session_data
        _memory_cache.move_to_end(key)
        while len(_memory_cache) > max_size:
            evicted_key, _ = _memory_cache.popitem(last=False)
            logger.info("Evicted session %s %s %s from memory cache (max_size=%d)", *evicted_key, max_size)
    gc.collect()


def _process_session_sync(year: int, event: str, session_type: str) -> ProcessedSession:
    """Internal synchronous worker: loads FastF1, processes, caches to disk, and frees memory."""
    key = (year, event, session_type)

    # 1. Quick in-memory cache check
    cached = _cache_get(key)
    if cached is not None:
        return cached

    # 2. Quick disk cache check
    disk_cached = load_cached_session(year, event, session_type)
    if disk_cached is not None:
        logger.info("Disk cache hit for session %s %s %s", *key)
        _cache_put(key, disk_cached)
        return disk_cached

    # 3. Synchronize via per-session lock to prevent duplicate initialization
    session_lock = _get_session_lock(key)
    with session_lock:
        # Re-check cache inside per-session lock
        cached = _cache_get(key)
        if cached is not None:
            return cached
        disk_cached = load_cached_session(year, event, session_type)
        if disk_cached is not None:
            _cache_put(key, disk_cached)
            return disk_cached

        # 4. Enforce global concurrency limit across different sessions
        logger.info("Processing session %s %s %s (cache miss)", *key)
        sync_sem = _get_sync_semaphore()
        with sync_sem:
            cached = _cache_get(key)
            if cached is not None:
                return cached
            disk_cached = load_cached_session(year, event, session_type)
            if disk_cached is not None:
                _cache_put(key, disk_cached)
                return disk_cached

        session = fastf1_service.get_session(year, event, session_type)
        info, drivers, circuit = build_session_overview(session, year, event, session_type)
        driver_abbrs = [session.get_driver(d)["Abbreviation"] for d in session.drivers]
        raw = load_driver_raw_telemetry(session, driver_abbrs)

        # Release raw session reference before frame building
        del session

        replay_data = build_replay_frames(raw)
        del raw

        processed = ProcessedSession(
            info=info,
            drivers=drivers,
            circuit=circuit,
            replay_data=replay_data,
        )

        save_cached_session(year, event, session_type, processed)
        _cache_put(key, processed)

        gc.collect()
        logger.info("Session %s %s %s successfully processed and cached (%d frames)", *key, len(replay_data.frames))
        return processed


async def get_processed_session(year: int, event: str, session_type: str) -> ProcessedSession:
    """Async single-flight entrypoint for obtaining a ProcessedSession."""
    key = (year, event, session_type)

    # 1. Quick in-memory check
    cached = _cache_get(key)
    if cached is not None:
        return cached

    # 2. Disk cache check
    disk_cached = load_cached_session(year, event, session_type)
    if disk_cached is not None:
        logger.info("Disk cache hit for session %s %s %s", *key)
        _cache_put(key, disk_cached)
        return disk_cached

    # 3. Coordinate single-flight in-flight async futures
    inflight_lock, load_sem = _get_async_primitives()
    async with inflight_lock:
        # Check cache again inside lock
        cached = _cache_get(key)
        if cached is not None:
            return cached

        if key in _inflight_futures:
            logger.info("Concurrent request waiting on in-flight load for %s %s %s", *key)
            fut = _inflight_futures[key]
            is_leader = False
        else:
            loop = asyncio.get_running_loop()
            fut = loop.create_future()
            _inflight_futures[key] = fut
            is_leader = True

    if not is_leader:
        return await fut

    # Leader task executes the session processing in threadpool with semaphore
    try:
        async with load_sem:
            processed = await asyncio.to_thread(_process_session_sync, year, event, session_type)
            fut.set_result(processed)
            return processed
    except BaseException as exc:
        fut.set_exception(exc)
        raise
    finally:
        async with inflight_lock:
            _inflight_futures.pop(key, None)


def get_replay_data(year: int, event: str, session_type: str) -> ReplayData:
    """Synchronous interface for getting ReplayData (compatible with existing callers and tests)."""
    proc = _process_session_sync(year, event, session_type)
    return proc.replay_data


def get_session_overview_and_replay(year: int, event: str, session_type: str) -> ProcessedSession:
    """Synchronous interface for getting the complete ProcessedSession."""
    return _process_session_sync(year, event, session_type)
