from pydantic import BaseModel, ConfigDict
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
    script_prompt: str = ""  # 生成逐字稿的自定义提示词
    scheduled_date: datetime | None = None  # 预计播出日期


class EpisodeCreate(EpisodeBase):
    pass


class EpisodeUpdate(BaseModel):
    # Issue #22: forbid unknown fields at the schema boundary so mass-
    # assignment becomes an explicit 422 from FastAPI's validation
    # layer instead of a silent no-op. Belt: this. Suspenders: the
    # explicit whitelist in update_episode itself.
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    status: EpisodeStatus | None = None
    intro_template: str | None = None
    outro_template: str | None = None
    script_prompt: str | None = None  # 生成逐字稿的自定义提示词
    script: str | None = None  # 整期逐字稿
    notes: str | None = None  # 节目级备注
    article: str | None = None  # 公众号图文正文
    cover_choice: str | None = None  # 封面方案选择（JSON 字符串）
    scheduled_date: datetime | None = None  # 预计播出日期


class EpisodeResponse(EpisodeBase):
    id: int
    status: EpisodeStatus
    script: str = ""
    audio_url: str = ""
    notes: str = ""
    article: str = ""
    title_suggestions: str = ""
    cover_choice: str = ""
    created_at: datetime
    published_at: datetime | None = None

    class Config:
        from_attributes = True
