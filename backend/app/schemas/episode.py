from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class EpisodeStatus(str, Enum):
    DRAFT = "draft"
    EDITING = "editing"
    PUBLISHED = "published"


class EpisodeBase(BaseModel):
    title: str
    intro_template: str = ""
    outro_template: str = ""


class EpisodeCreate(EpisodeBase):
    pass


class EpisodeUpdate(BaseModel):
    title: str | None = None
    status: EpisodeStatus | None = None
    intro_template: str | None = None
    outro_template: str | None = None


class EpisodeResponse(EpisodeBase):
    id: int
    status: EpisodeStatus
    created_at: datetime
    published_at: datetime | None = None

    class Config:
        from_attributes = True
