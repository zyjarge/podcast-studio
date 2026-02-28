from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey, Float
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
    
    # 评分字段
    score = Column(Float, default=0.0)           # 综合评分 0-100
    score_authority = Column(Float, default=0.0)  # 来源权威性
    score_timeliness = Column(Float, default=0.0) # 时效性
    score_depth = Column(Float, default=0.0)      # 内容深度
    score_updated_at = Column(DateTime, nullable=True)  # 评分更新时间
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rss_source = relationship("RSSSource", back_populates="news")
    episode_news = relationship("EpisodeNews", back_populates="news")
