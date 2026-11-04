"""Custom exceptions for telemetry and replay pipelines."""
from __future__ import annotations


class TelemetryDataUnavailableError(Exception):
    """Raised when real telemetry, laps, or car position data is unavailable upstream.

    This explicitly differentiates upstream data unavailability (such as F1 live timing
    authentication requirements, missing session data, or empty telemetry streams)
    from unexpected internal server crashes.
    """

    def __init__(self, message: str, status_code: int = 404, requires_auth: bool = False):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.requires_auth = requires_auth

    def __str__(self) -> str:
        return self.message
