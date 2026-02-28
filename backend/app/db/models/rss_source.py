from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime


class RSSSource(Base):
    __tablename__ = "rss_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    auto_mode = Column(Boolean, default=False)
    
    # 来源权威性评分 (0-100)
    authority_score = Column(Float, default=50.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    news = relationship("News", back_populates="rss_source")
