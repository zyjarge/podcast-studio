from contextlib import asynccontextmanager
import os
import re
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List
from app.core.config import settings
from app.db.session import engine, Base
from app.db import models  # noqa: F401
from app.api.v1.router import api_router
import logging

logger = logging.getLogger(__name__)

# --- path-traversal hardening for /audio/{episode_id}/{filename} -----------
# Filenames must be a flat id-style string. We refuse anything containing
# path separators, dot-segments, or shell metacharacters.
_SAFE_FILENAME = re.compile(r"^[A-Za-z0-9_\-\.]+$")
# Resolved audio root. We pin against the same absolute directory the runtime
# is launched from (which is backend/ when uvicorn is started there). Using
# an absolute resolved path lets us do a strict prefix check rather than
# relying on os.path.join, which silently strips dot-segments.
_AUDIO_ROOT = (Path(os.getcwd()) / "data" / "audio").resolve()


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

# CORS - explicit allow-list from settings.CORS_ALLOWED_ORIGINS. The previous
# config used allow_origins=["*"] with allow_credentials=True, which violates
# the W3C CORS spec (browsers reject it the moment a credentialed request
# arrives) and exposes the API to any origin. See issue #2.
_cors_origins: List[str] = [
    o.strip() for o in settings.CORS_ALLOWED_ORIGINS.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,  # no cookie-based auth yet; flip True when adding it
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/audio/{episode_id}/{filename}")
async def serve_audio(episode_id: int, filename: str):
    """Serve generated audio files.

    Path-traversal hardening (issue #3): we never trust the raw filename.
    First, we restrict it to a safe character class. Then we resolve the
    candidate path and assert it still lives under data/audio/.
    """
    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="invalid filename")
    # Episode id is typed int, but be defensive: refuse negatives / zero too.
    if episode_id <= 0:
        raise HTTPException(status_code=400, detail="invalid episode id")

    target = (_AUDIO_ROOT / f"episode_{episode_id}" / filename).resolve()
    try:
        # Path.is_relative_to lands in 3.9+, but a str.startswith check
        # with the resolved prefix is more portable across Python 3.8+.
        target.relative_to(_AUDIO_ROOT)
    except ValueError:
        raise HTTPException(status_code=400, detail="path traversal blocked")

    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(target), media_type="audio/mpeg")
