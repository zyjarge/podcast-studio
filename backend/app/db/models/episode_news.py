from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import enum


class NewsStatus(str, enum.Enum):
    PENDING = "pending"
    GENERATING = "generating"
    SCRIPT_DONE = "script_done"
    AUDIO_DONE = "audio_done"
    ERROR = "error"


class EpisodeNews(Base):
    __tablename__ = "episode_news"

    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id"))
    news_id = Column(Integer, ForeignKey("news.id"))
    order = Column(Integer, default=0)
    status = Column(SQLEnum(NewsStatus), default=NewsStatus.PENDING)
    prompt = Column(Text, default="")
    script = Column(Text, default="")
    audio_url = Column(String, default="")
    error_message = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    episode = relationship("Episode", back_populates="episode_news")
    news = relationship("News", back_populates="episode_news")
