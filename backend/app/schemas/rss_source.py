from pydantic import BaseModel
from datetime import datetime


class RSSSourceBase(BaseModel):
    name: str
    url: str
    enabled: bool = True
    auto_mode: bool = False


class RSSSourceCreate(RSSSourceBase):
    pass


class RSSSourceUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    enabled: bool | None = None
    auto_mode: bool | None = None


class RSSSourceResponse(RSSSourceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
