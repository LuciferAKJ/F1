import logging
import os

import fastf1
import platformdirs

from config import get_settings
from telemetry.exceptions import TelemetryDataUnavailableError

logger = logging.getLogger(__name__)
_cache_initialized = False
_auth_initialized = False


def setup_authentication() -> None:
    """Configure official FastF1 authentication credentials from private server environment.

    Only operates if explicitly configured via FASTF1_AUTH_JSON. Credentials and token
    contents are never logged or exposed. Does not impact application startup or /api/health.
    """
    global _auth_initialized
    if _auth_initialized:
        return
    token_json = os.environ.get("FASTF1_AUTH_JSON")
    if not token_json or not token_json.strip():
        _auth_initialized = True
        return

    try:
        user_dir = platformdirs.user_data_dir("fastf1")
        os.makedirs(user_dir, exist_ok=True)
        auth_file = os.path.join(user_dir, "f1auth.json")
        with open(auth_file, "w", encoding="utf-8") as f:
            f.write(token_json.strip())
        logger.info("Configured FastF1 authentication credentials into %s", auth_file)
    except Exception as exc:
        logger.warning("Could not persist FastF1 authentication credentials: %s", exc)
    finally:
        _auth_initialized = True


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


def get_session(year: int, event: str, session_type: str):
    """Load a raw FastF1 session object directly.

    Callers must extract required telemetry and immediately release references
    to allow garbage collection.
    """
    init_cache()
    setup_authentication()
    logger.info("Loading FastF1 session %s %s %s", year, event, session_type)

    try:
        session = fastf1.get_session(year, event, session_type)
    except Exception as exc:
        raise TelemetryDataUnavailableError(
            f"Failed to find session for {year} {event} {session_type}: {exc}"
        ) from exc

    try:
        session.load(telemetry=True, weather=False, laps=True)
    except Exception as exc:
        raise TelemetryDataUnavailableError(
            f"Failed to load telemetry data for {year} {event} {session_type}: {exc}"
        ) from exc

    # Validate essential session datasets are present
    has_laps = hasattr(session, "_laps") and session._laps is not None and not session._laps.empty
    if not has_laps:
        raise TelemetryDataUnavailableError(
            f"Real telemetry and timing data unavailable for {year} {event} {session_type}. "
            "Upstream Formula 1 live-timing archive is restricted or does not contain data for this session."
        )

    if not hasattr(session, "drivers") or not session.drivers:
        raise TelemetryDataUnavailableError(
            f"No drivers found in loaded session for {year} {event} {session_type}."
        )

    return session
