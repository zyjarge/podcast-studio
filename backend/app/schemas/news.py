from pydantic import BaseModel
from datetime import datetime


class NewsBase(BaseModel):
    title: str
    source: str | None = None
    url: str
    summary: str | None = None
    keywords: list[str] = []


class NewsScore(BaseModel):
    """新闻评分详情"""
    score: float = 0.0           # 综合评分 0-100
    score_authority: float = 0.0  # 来源权威性
    score_timeliness: float = 0.0  # 时效性
    score_depth: float = 0.0     # 内容深度
    stars: int = 1               # 星级 1-5


class NewsResponse(NewsBase):
    id: int
    content: str | None
    rss_source_id: int | None
    score: float = 0.0
    score_authority: float = 0.0
    score_timeliness: float = 0.0
    score_depth: float = 0.0
    score_updated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
