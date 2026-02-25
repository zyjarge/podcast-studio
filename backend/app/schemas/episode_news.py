from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class NewsStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    SCRIPT_DONE = "script_done"
    AUDIO_DONE = "audio_done"
    ERROR = "error"


class EpisodeNewsBase(BaseModel):
    prompt: str = ""


class EpisodeNewsCreate(EpisodeNewsBase):
    news_ids: list[int]


class EpisodeNewsUpdate(BaseModel):
    order: int | None = None
    status: NewsStatus | None = None
    prompt: str | None = None
    script: str | None = None
    audio_url: str | None = None


class EpisodeNewsResponse(EpisodeNewsBase):
    id: int
    episode_id: int
    news_id: int
    order: int
    status: NewsStatus
    script: str
    audio_url: str
    error_message: str | None
    updated_at: datetime

    class Config:
        from_attributes = True
