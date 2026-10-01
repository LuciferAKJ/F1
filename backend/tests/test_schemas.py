"""Unit tests for Pydantic models serialization and camelCase alias generation."""

from models.schemas import DriverMeta, SeasonEvent, SessionInfo


def test_camel_case_alias_serialization():
    meta = DriverMeta(
        abbreviation="VER",
        team_name="Red Bull Racing",
        team_color="#3671C6",
        driver_number="1",
    )
    dumped = meta.model_dump(by_alias=True)

    assert "teamName" in dumped
    assert "teamColor" in dumped
    assert "driverNumber" in dumped
    assert dumped["teamName"] == "Red Bull Racing"


def test_season_event_dump():
    event = SeasonEvent(
        round_number=1,
        event_name="Bahrain Grand Prix",
        country="Bahrain",
        location="Sakhir",
        event_date="2024-03-02",
    )
    dumped = event.model_dump(by_alias=True)
    assert dumped["roundNumber"] == 1
    assert dumped["eventName"] == "Bahrain Grand Prix"


def test_session_info_optional_total_laps():
    info = SessionInfo(
        year=2024,
        event="Monaco",
        session_type="R",
        session_name="Race",
    )
    assert info.total_laps is None
    dumped = info.model_dump(by_alias=True)
    assert dumped["sessionType"] == "R"
