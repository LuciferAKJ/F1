import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from config import get_settings
from api.sessions import router as sessions_router
from api.replay import router as replay_router
from api.ws_replay import router as ws_replay_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(title="F1 Race Replay API", version="0.1.0", default_response_class=ORJSONResponse)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
)

app.include_router(sessions_router, prefix="/api/sessions", tags=["sessions"])
app.include_router(replay_router, prefix="/api/replay", tags=["replay"])
app.include_router(ws_replay_router, tags=["websocket"])


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
