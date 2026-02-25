from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class NewsStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    SCRIPT_DONE = "script_done"
    AUDIO_DONE = "audio_done"
    ERROR = "error"


class NewsSummary(BaseModel):
    """简化的新闻信息"""
    id: int
    title: str
    source: str | None = None
    summary: str | None = None

    class Config:
        from_attributes = True


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
    news: NewsSummary | None = None

    class Config:
        from_attributes = True
