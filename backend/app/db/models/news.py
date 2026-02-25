from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime


class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    source = Column(String)
    url = Column(String, nullable=False)
    summary = Column(Text)
    keywords = Column(JSON, default=list)
    content = Column(Text)
    rss_source_id = Column(Integer, ForeignKey("rss_sources.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rss_source = relationship("RSSSource", back_populates="news")
    episode_news = relationship("EpisodeNews", back_populates="news")
