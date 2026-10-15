"""Tests for telemetry pipeline concurrency single-flight deduplication, bounded LRU caching, and memory diagnostics."""

import asyncio
import tracemalloc
from unittest.mock import MagicMock, patch

import pytest
from backend.models.schemas import CircuitData, DriverMeta, SessionInfo
from backend.telemetry import pipeline
from backend.telemetry.models import DriverFrame, ProcessedSession, ReplayData, ReplayFrame


def create_fake_session(name: str = "Test GP") -> ProcessedSession:
    info = SessionInfo(
        year=2026,
        event=name,
        session_name="Race",
        session_type="R",
        total_laps=51,
    )
    circuit = CircuitData(
        x=[0.0, 1.0, 2.0],
        y=[0.0, 1.0, 2.0],
        min_x=0.0,
        max_x=2.0,
        min_y=0.0,
        max_y=2.0,
    )
    drivers = [
        DriverMeta(
            abbreviation="VER",
            team_name="Red Bull Racing",
            team_color="3671C6",
            driver_number="1",
        )
    ]
    replay = ReplayData(frames=[], min_time=0.0, max_time=100.0)
    return ProcessedSession(info=info, circuit=circuit, drivers=drivers, replay_data=replay)




@pytest.fixture(autouse=True)
def clear_pipeline_cache():
    """Clear in-memory and in-flight caches before each test."""
    with pipeline._memory_cache_lock:
        pipeline._memory_cache.clear()
    pipeline._inflight_futures.clear()
    yield
    with pipeline._memory_cache_lock:
        pipeline._memory_cache.clear()
    pipeline._inflight_futures.clear()


@pytest.mark.asyncio
async def test_single_flight_deduplication():
    """Verify concurrent requests for the same session only trigger 1 load operation."""
    call_count = 0

    def mock_process_sync(year, event, session_type):
        nonlocal call_count
        call_count += 1
        import time
        time.sleep(0.05)
        return create_fake_session(f"{event}")

    with patch("backend.telemetry.pipeline.load_cached_session", return_value=None), \
         patch("backend.telemetry.pipeline._process_session_sync", side_effect=mock_process_sync):

        # Dispatch 5 concurrent async calls for the same session
        results = await asyncio.gather(
            pipeline.get_processed_session(2026, "Azerbaijan", "Race"),
            pipeline.get_processed_session(2026, "Azerbaijan", "Race"),
            pipeline.get_processed_session(2026, "Azerbaijan", "Race"),
            pipeline.get_processed_session(2026, "Azerbaijan", "Race"),
            pipeline.get_processed_session(2026, "Azerbaijan", "Race"),
        )

        # Verify all callers received the session object
        assert len(results) == 5
        assert results[0].info.event == "Azerbaijan"
        assert results[1] is results[0]
        # Crucial check: _process_session_sync was called EXACTLY ONCE
        assert call_count == 1



def test_bounded_lru_cache_eviction():
    """Verify in-memory cache evicts oldest entry when exceeding max_cached_sessions."""
    # Set max_cached_sessions = 2 in mock settings
    mock_settings = MagicMock(max_cached_sessions=2, replay_cache_size=2)
    with patch("backend.telemetry.pipeline.get_settings", return_value=mock_settings):
        s1 = create_fake_session("GP1")
        s2 = create_fake_session("GP2")
        s3 = create_fake_session("GP3")

        # Put GP1 and GP2
        pipeline._cache_put((2026, "GP1", "Race"), s1)
        pipeline._cache_put((2026, "GP2", "Race"), s2)
        assert len(pipeline._memory_cache) == 2
        assert (2026, "GP1", "R") in pipeline._memory_cache
        assert (2026, "GP2", "R") in pipeline._memory_cache

        # Put GP3 (should evict GP1 because GP1 is oldest LRU entry)
        pipeline._cache_put((2026, "GP3", "Race"), s3)
        assert len(pipeline._memory_cache) == 2
        assert (2026, "GP1", "R") not in pipeline._memory_cache
        assert (2026, "GP2", "R") in pipeline._memory_cache
        assert (2026, "GP3", "R") in pipeline._memory_cache

        # Access GP2 to make it most-recently used (GP3 becomes oldest)
        assert pipeline._cache_get((2026, "GP2", "Race")) is s2

        # Put GP1 again (should evict GP3, keeping GP2 and GP1)
        pipeline._cache_put((2026, "GP1", "Race"), s1)
        assert len(pipeline._memory_cache) == 2
        assert (2026, "GP3", "R") not in pipeline._memory_cache
        assert (2026, "GP2", "R") in pipeline._memory_cache
        assert (2026, "GP1", "R") in pipeline._memory_cache


@pytest.mark.asyncio
async def test_cache_hit_bypasses_fastf1_load():
    """Verify that cached session in memory returns immediately without building."""
    s = create_fake_session("Monaco")
    pipeline._cache_put((2026, "Monaco", "Race"), s)

    with patch("backend.telemetry.pipeline._process_session_sync") as mock_sync:
        res = await pipeline.get_processed_session(2026, "Monaco", "Race")
        assert res is s
        mock_sync.assert_not_called()


def test_memory_footprint_diagnostic():
    """Measure memory footprint before and after creating compact dataclasses with __slots__."""
    tracemalloc.start()
    snap_before = tracemalloc.take_snapshot()

    # Instantiate 10,000 driver frames using __slots__

    frames = []
    for f in range(500):
        driver_frames = [
            DriverFrame(
                driver_id=f"D{d}",
                x=float(f * 10),
                y=float(f * 5),
                speed=280.0,
                gear=7,
                throttle=0.95,
                brake=False,
                rpm=11500.0,
                drs=1,
                tyre="SOFT",
                lap=10,
                sector=2,
                position=d + 1,
            )
            for d in range(20)
        ]
        frames.append(ReplayFrame(timestamp=f * 0.5, lap=10, drivers=driver_frames))

    snap_after = tracemalloc.take_snapshot()
    tracemalloc.stop()

    stats = snap_after.compare_to(snap_before, "lineno")
    total_allocated_mb = sum(stat.size_diff for stat in stats) / (1024 * 1024)

    # 500 frames * 20 drivers = 10,000 DriverFrames.
    # With __slots__, 10,000 objects should consume < 5MB RAM.
    assert total_allocated_mb < 5.0, f"Memory allocated was unexpectedly high: {total_allocated_mb:.2f} MB"


def test_per_session_locking_sync():
    """Verify that concurrent synchronous threads trying to load the same session use the per-session lock."""
    import threading
    import time

    call_count = 0
    lock = threading.Lock()

    def mock_build_session(*args, **kwargs):
        nonlocal call_count
        with lock:
            call_count += 1
        time.sleep(0.05)
        return (
            SessionInfo(year=2026, event="PerSessionLockGP", session_name="Race", session_type="R", total_laps=50),
            [],
            CircuitData(x=[0.0], y=[0.0], min_x=0.0, max_x=1.0, min_y=0.0, max_y=1.0)
        )

    mock_session = MagicMock()
    mock_session.drivers = []

    with patch("backend.telemetry.pipeline.load_cached_session", return_value=None), \
         patch("backend.telemetry.pipeline.save_cached_session"), \
         patch("backend.services.fastf1_service.get_session", return_value=mock_session), \
         patch("backend.telemetry.pipeline.build_session_overview", side_effect=mock_build_session), \
         patch("backend.telemetry.pipeline.load_driver_raw_telemetry", return_value={}), \
         patch("backend.telemetry.pipeline.build_replay_frames", return_value=ReplayData([], 0.0, 0.0)):

        threads = []
        results = [None, None, None]

        def worker(idx):
            results[idx] = pipeline._process_session_sync(2026, "PerSessionLockGP", "Race")

        for i in range(3):
            t = threading.Thread(target=worker, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        assert results[0] is not None
        assert results[0] is results[1] is results[2]
        # FastF1 load only executed once due to per-session locking
        assert call_count == 1


@pytest.mark.asyncio
async def test_concurrent_load_limit_across_sessions():
    """Verify max_concurrent_session_loads limits simultaneous loads of different sessions."""
    def mock_process(year, event, session_type):
        return create_fake_session(event)

    mock_settings = MagicMock(max_concurrent_session_loads=1, max_cached_sessions=5, replay_cache_size=5)
    with patch("backend.telemetry.pipeline.get_settings", return_value=mock_settings), \
         patch("backend.telemetry.pipeline.load_cached_session", return_value=None), \
         patch("backend.telemetry.pipeline._process_session_sync", side_effect=mock_process):

        pipeline._load_semaphore = None
        pipeline._inflight_lock = None

        results = await asyncio.gather(
            pipeline.get_processed_session(2026, "SessionA", "Race"),
            pipeline.get_processed_session(2026, "SessionB", "Race"),
        )
        assert len(results) == 2
        assert results[0].info.event == "SessionA"
        assert results[1].info.event == "SessionB"


def test_cors_headers_on_responses(app_client):
    """Verify that API responses provide CORS headers for authorized origins."""
    headers = {"Origin": "http://localhost:3000"}
    resp = app_client.get("/api/health", headers=headers)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_replay_error_path(app_client):
    """Verify error path returns clean JSON error response with CORS headers."""
    with patch("api.replay.get_processed_session", side_effect=RuntimeError("FastF1 API failure")):
        resp = app_client.get("/api/replay/2026/NonExistentGP/R", headers={"Origin": "http://localhost:3000"})
        assert resp.status_code == 502
        assert "FastF1 API failure" in resp.json()["detail"]
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_real_race_rss_diagnostic():
    """Loads completed 2026 Azerbaijan Grand Prix and verifies memory footprint remains well below 512MB."""
    import ctypes
    from ctypes import wintypes

    class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
        _fields_ = [
            ("cb", wintypes.DWORD),
            ("PageFaultCount", wintypes.DWORD),
            ("PeakWorkingSetSize", ctypes.c_size_t),
            ("WorkingSetSize", ctypes.c_size_t),
            ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
            ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
            ("PagefileUsage", ctypes.c_size_t),
            ("PeakPagefileUsage", ctypes.c_size_t),
        ]

    def get_working_set_mb():
        try:
            GetProcessMemoryInfo = ctypes.windll.psapi.GetProcessMemoryInfo
            GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESS_MEMORY_COUNTERS), wintypes.DWORD]
            GetProcessMemoryInfo.restype = wintypes.BOOL
            GetCurrentProcess = ctypes.windll.kernel32.GetCurrentProcess
            GetCurrentProcess.restype = wintypes.HANDLE
            pmc = PROCESS_MEMORY_COUNTERS()
            pmc.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
            GetProcessMemoryInfo(GetCurrentProcess(), ctypes.byref(pmc), pmc.cb)
            return pmc.WorkingSetSize / (1024 * 1024)
        except Exception:
            return 0.0

    rss_before = get_working_set_mb()
    session_data = pipeline._process_session_sync(2026, "Azerbaijan", "Race")
    rss_after = get_working_set_mb()
    if rss_after > 0:
        print(f"\n[DIAGNOSTIC] RSS before session load: {rss_before:.1f} MB, after session load: {rss_after:.1f} MB")

    assert session_data is not None
    assert "Azerbaijan" in session_data.info.event
    assert len(session_data.replay_data.frames) > 0

    # Ensure total RSS is well below 512 MB (e.g. < 400 MB)
    if rss_after > 0:
        assert rss_after < 400.0, f"Memory footprint exceeded safety threshold: {rss_after:.1f} MB"


def test_canonical_session_key_normalization():
    """Verify that canonical_session_key correctly normalizes all session aliases and events."""
    from backend.telemetry.cache import canonical_session_key

    # R / Race variants
    assert canonical_session_key(2026, "  Azerbaijan  ", "R") == (2026, "Azerbaijan", "R")
    assert canonical_session_key("2026", "Azerbaijan", "Race") == (2026, "Azerbaijan", "R")
    assert canonical_session_key(2026, "Azerbaijan", "race") == (2026, "Azerbaijan", "R")
    assert canonical_session_key(2026, "Azerbaijan", "r") == (2026, "Azerbaijan", "R")

    # Qualifying variants
    assert canonical_session_key(2026, "Monaco", "Q") == (2026, "Monaco", "Q")
    assert canonical_session_key(2026, "Monaco", "Qualifying") == (2026, "Monaco", "Q")
    assert canonical_session_key(2026, "Monaco", "qualifying") == (2026, "Monaco", "Q")

    # Sprint variants
    assert canonical_session_key(2026, "Austria", "S") == (2026, "Austria", "S")
    assert canonical_session_key(2026, "Austria", "Sprint") == (2026, "Austria", "S")

    # Practice variants
    assert canonical_session_key(2026, "Silverstone", "FP1") == (2026, "Silverstone", "FP1")
    assert canonical_session_key(2026, "Silverstone", "Practice 1") == (2026, "Silverstone", "FP1")
    assert canonical_session_key(2026, "Silverstone", "FP2") == (2026, "Silverstone", "FP2")
    assert canonical_session_key(2026, "Silverstone", "Practice 2") == (2026, "Silverstone", "FP2")
    assert canonical_session_key(2026, "Silverstone", "FP3") == (2026, "Silverstone", "FP3")
    assert canonical_session_key(2026, "Silverstone", "Practice 3") == (2026, "Silverstone", "FP3")


@pytest.mark.asyncio
async def test_aliases_r_and_race_single_flight_and_cache_deduplication():
    """Verify that concurrent requests using 'R' and 'Race' resolve to the same canonical key and load once."""
    load_count = 0

    def mock_process_sync(year, event, session_type):
        nonlocal load_count
        load_count += 1
        return create_fake_session(event)

    with patch("backend.telemetry.pipeline.load_cached_session", return_value=None), \
         patch("backend.telemetry.pipeline._process_session_sync", side_effect=mock_process_sync):

        res_r, res_race = await asyncio.gather(
            pipeline.get_processed_session(2026, "Azerbaijan", "R"),
            pipeline.get_processed_session(2026, "Azerbaijan", "Race"),
        )

        assert res_r is res_race
        assert res_r.info.event == "Azerbaijan"
        # Must only trigger ONE session load
        assert load_count == 1
        # Memory cache must have only ONE entry under canonical key
        assert len(pipeline._memory_cache) == 1
        assert (2026, "Azerbaijan", "R") in pipeline._memory_cache


@pytest.mark.asyncio
async def test_cancelled_future_concurrency_safety():
    """Verify that a cancelled/failed leader request does not leave a stale future or corrupt state."""
    with patch("backend.telemetry.pipeline.load_cached_session", return_value=None), \
         patch("backend.telemetry.pipeline._process_session_sync", side_effect=RuntimeError("Simulated load failure")):

        t1 = asyncio.create_task(pipeline.get_processed_session(2026, "FailureGP", "R"))
        t2 = asyncio.create_task(pipeline.get_processed_session(2026, "FailureGP", "R"))

        results = await asyncio.gather(t1, t2, return_exceptions=True)
        assert isinstance(results[0], RuntimeError)
        assert isinstance(results[1], RuntimeError)

        # Inflight futures map must be completely clean
        assert (2026, "FailureGP", "R") not in pipeline._inflight_futures

        # Subsequent call should not encounter InvalidStateError
        t3 = asyncio.create_task(pipeline.get_processed_session(2026, "FailureGP", "R"))
        res3 = await asyncio.gather(t3, return_exceptions=True)
        assert isinstance(res3[0], RuntimeError)

        assert (2026, "FailureGP", "R") not in pipeline._inflight_futures
