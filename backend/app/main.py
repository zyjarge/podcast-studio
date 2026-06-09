from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from app.core.config import settings
from app.db.session import engine, Base
from app.db import models  # noqa: F401
from app.api.v1.router import api_router
import logging

logger = logging.getLogger(__name__)


def _migrate_db():
    """Add missing columns to existing tables (SQLite ALTER TABLE, safe to re-run)."""
    import sqlite3
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check existing columns
        cursor.execute("PRAGMA table_info(episode_news)")
        en_cols = {row[1] for row in cursor.fetchall()}

        cursor.execute("PRAGMA table_info(episodes)")
        ep_cols = {row[1] for row in cursor.fetchall()}

        # Add missing columns
        if "notes" not in en_cols:
            cursor.execute("ALTER TABLE episode_news ADD COLUMN notes TEXT DEFAULT ''")
            logger.info("Migration: added episode_news.notes column")

        if "script" not in ep_cols:
            cursor.execute("ALTER TABLE episodes ADD COLUMN script TEXT DEFAULT ''")
            logger.info("Migration: added episodes.script column")

        if "audio_url" not in ep_cols:
            cursor.execute("ALTER TABLE episodes ADD COLUMN audio_url TEXT DEFAULT ''")
            logger.info("Migration: added episodes.audio_url column")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Migration check failed (may be first run): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    _migrate_db()
    yield
    # Shutdown


app = FastAPI(title="Podcast Studio API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/audio/{episode_id}/{filename}")
async def serve_audio(episode_id: int, filename: str):
    """Serve generated audio files"""
    audio_path = os.path.join("data/audio", f"episode_{episode_id}", filename)
    if os.path.exists(audio_path):
        return FileResponse(audio_path, media_type="audio/mpeg")
    return {"error": "File not found"}
