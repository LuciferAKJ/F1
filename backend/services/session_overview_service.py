import logging

from models.schemas import CircuitData, DriverMeta, SessionInfo

logger = logging.getLogger(__name__)

SESSION_NAMES = {
    "R": "Race", "Q": "Qualifying", "S": "Sprint",
    "FP1": "Practice 1", "FP2": "Practice 2", "FP3": "Practice 3",
}


def build_session_overview(session, year: int, event: str, session_type: str) -> tuple[SessionInfo, list[DriverMeta], CircuitData]:
    drivers: list[DriverMeta] = []
    circuit_x: list[float] = []
    circuit_y: list[float] = []

    for drv in session.drivers:
        try:
            info = session.get_driver(drv)
            abbr = info["Abbreviation"]
            drivers.append(DriverMeta(
                abbreviation=abbr,
                team_name=info.get("TeamName", "Unknown"),
                team_color=f"#{info.get('TeamColor', 'FFFFFF')}",
                driver_number=str(drv),
            ))
            if not circuit_x:
                laps = session.laps.pick_drivers(abbr)
                if not laps.empty:
                    tel = laps.pick_fastest().get_telemetry()
                    circuit_x = tel["X"].tolist()
                    circuit_y = tel["Y"].tolist()
        except Exception as exc:
            logger.warning("Skipping driver %s: %s", drv, exc)

    circuit = CircuitData(
        x=circuit_x, y=circuit_y,
        min_x=min(circuit_x) if circuit_x else 0.0, max_x=max(circuit_x) if circuit_x else 0.0,
        min_y=min(circuit_y) if circuit_y else 0.0, max_y=max(circuit_y) if circuit_y else 0.0,
    )

    total_laps = int(session.laps["LapNumber"].max()) if not session.laps.empty else None
    info = SessionInfo(
        year=year, event=event, session_type=session_type,
        session_name=SESSION_NAMES.get(session_type, session_type),
        total_laps=total_laps,
    )
    return info, drivers, circuit
