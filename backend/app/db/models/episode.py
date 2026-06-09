from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import enum


class EpisodeStatus(str, enum.Enum):
    DRAFT = "draft"
    EDITING = "editing"
    PUBLISHED = "published"


class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    status = Column(SQLEnum(EpisodeStatus), default=EpisodeStatus.DRAFT)
    intro_template = Column(Text, default="")
    outro_template = Column(Text, default="")
    script_prompt = Column(Text, default="")
    script = Column(Text, default="")  # 整期节目逐字稿
    audio_url = Column(String, default="")  # 生成的音频文件路径
    scheduled_date = Column(DateTime, nullable=True)  # 预计播出日期，与日历绑定
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    episode_news = relationship("EpisodeNews", back_populates="episode")
