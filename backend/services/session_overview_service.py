import logging

from models.schemas import CircuitData, DriverMeta, SessionInfo
from telemetry.exceptions import TelemetryDataUnavailableError

logger = logging.getLogger(__name__)

SESSION_NAMES = {
    "R": "Race", "Q": "Qualifying", "S": "Sprint",
    "FP1": "Practice 1", "FP2": "Practice 2", "FP3": "Practice 3",
}


def build_session_overview(session, year: int, event: str, session_type: str) -> tuple[SessionInfo, list[DriverMeta], CircuitData]:
    has_laps = hasattr(session, "_laps") and session._laps is not None and not session._laps.empty
    if not has_laps:
        raise TelemetryDataUnavailableError(
            f"Lap timing data unavailable for {year} {event} {session_type}. "
            "Upstream live-timing archive is restricted or session timing has not been recorded."
        )

    drivers: list[DriverMeta] = []
    circuit_x: list[float] = []
    circuit_y: list[float] = []

    for drv in getattr(session, "drivers", []):
        try:
            info = session.get_driver(drv)
            abbr = info["Abbreviation"]
            drivers.append(DriverMeta(
                abbreviation=abbr,
                team_name=info.get("TeamName", "Unknown"),
                team_color=f"#{info.get('TeamColor', 'FFFFFF')}",
                driver_number=str(drv),
            ))
            if not circuit_x and has_laps:
                laps = session.laps.pick_drivers(abbr)
                if not laps.empty:
                    fastest = laps.pick_fastest()
                    if fastest is not None and not fastest.empty:
                        tel = fastest.get_telemetry()
                        if tel is not None and not tel.empty and "X" in tel.columns and "Y" in tel.columns:
                            circuit_x = tel["X"].dropna().tolist()
                            circuit_y = tel["Y"].dropna().tolist()
        except Exception as exc:
            logger.warning("Skipping driver %s: %s", drv, exc)

    circuit = CircuitData(
        x=circuit_x, y=circuit_y,
        min_x=min(circuit_x) if circuit_x else 0.0, max_x=max(circuit_x) if circuit_x else 0.0,
        min_y=min(circuit_y) if circuit_y else 0.0, max_y=max(circuit_y) if circuit_y else 0.0,
    )

    total_laps = None
    if has_laps:
        try:
            total_laps = int(session._laps["LapNumber"].max()) if not session._laps.empty else None
        except Exception:
            total_laps = None

    info = SessionInfo(
        year=year, event=event, session_type=session_type,
        session_name=SESSION_NAMES.get(session_type, session_type),
        total_laps=total_laps,
        is_demo=False,
    )
    return info, drivers, circuit
