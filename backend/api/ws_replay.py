"""WebSocket replay streaming: /ws/replay/{year}/{event}/{session_type}

Client -> Server messages (JSON):
  {"action": "play"}
  {"action": "pause"}
  {"action": "seek", "time": 123.4}
  {"action": "speed", "value": 2}

Server -> Client messages (JSON):
  {"type": "metadata", "duration": ..., "frameInterval": ..., "totalLaps": ...}
  {"type": "frame", "frame": {...ReplayFrameOut...}}
  {"type": "error", "message": "..."}
"""
from __future__ import annotations
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from telemetry.pipeline import get_replay_data
from telemetry.query import frame_at_timestamp
from telemetry.processor import FRAME_INTERVAL_S

logger = logging.getLogger(__name__)
router = APIRouter()


class PlaybackState:
    def __init__(self):
        self.playing = False
        self.speed = 1.0
        self.race_time = 0.0


def _frame_to_dict(frame) -> dict:
    return {
        "timestamp": frame.timestamp,
        "lap": frame.lap,
        "drivers": [
            {
                "driverId": d.driver_id, "x": d.x, "y": d.y, "speed": d.speed,
                "gear": d.gear, "throttle": d.throttle, "brake": d.brake,
                "rpm": d.rpm, "drs": d.drs, "tyre": d.tyre, "lap": d.lap,
                "sector": d.sector, "position": d.position,
            }
            for d in frame.drivers
        ],
    }


@router.websocket("/ws/replay/{year}/{event}/{session_type}")
async def ws_replay(websocket: WebSocket, year: int, event: str, session_type: str) -> None:
    await websocket.accept()

    try:
        replay_data = await asyncio.to_thread(get_replay_data, year, event, session_type)
    except Exception as exc:  # noqa: BLE001
        await websocket.send_json({"type": "error", "message": f"Failed to load replay: {exc}"})
        await websocket.close()
        return

    if not replay_data.frames:
        await websocket.send_json({"type": "error", "message": "No frames available for this session"})
        await websocket.close()
        return

    state = PlaybackState()
    state.race_time = replay_data.frames[0].timestamp

    await websocket.send_json({
        "type": "metadata",
        "duration": replay_data.max_time,
        "frameInterval": FRAME_INTERVAL_S,
        "frameCount": len(replay_data.frames),
    })

    async def receive_loop() -> None:
        while True:
            msg = await websocket.receive_json()
            action = msg.get("action")
            if action == "play":
                state.playing = True
            elif action == "pause":
                state.playing = False
            elif action == "seek":
                t = float(msg.get("time", state.race_time))
                state.race_time = max(0.0, min(replay_data.max_time, t))
            elif action == "speed":
                state.speed = max(0.25, min(16.0, float(msg.get("value", 1.0))))

    async def send_loop() -> None:
        while True:
            if state.playing:
                frame = frame_at_timestamp(replay_data.frames, state.race_time)
                if frame:
                    await websocket.send_json({"type": "frame", "frame": _frame_to_dict(frame)})
                state.race_time += FRAME_INTERVAL_S * state.speed
                if state.race_time >= replay_data.max_time:
                    state.race_time = replay_data.max_time
                    state.playing = False
            await asyncio.sleep(FRAME_INTERVAL_S)

    receiver = asyncio.create_task(receive_loop())
    sender = asyncio.create_task(send_loop())
    try:
        await asyncio.wait([receiver, sender], return_when=asyncio.FIRST_COMPLETED)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s %s %s", year, event, session_type)
    finally:
        receiver.cancel()
        sender.cancel()
