"""Unit tests for the health check endpoint."""
from __future__ import annotations


def test_api_health(app_client):
    response = app_client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
