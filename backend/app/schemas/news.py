from pydantic import BaseModel
from datetime import datetime


class NewsBase(BaseModel):
    title: str
    source: str | None = None
    url: str
    summary: str | None = None
    keywords: list[str] = []


class NewsResponse(NewsBase):
    id: int
    content: str | None
    rss_source_id: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
