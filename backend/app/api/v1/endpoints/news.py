from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import News
from app.schemas.news import NewsResponse
from typing import List

router = APIRouter()


@router.get("/", response_model=List[NewsResponse])
def list_news(source_id: int | None = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(News)
    if source_id:
        query = query.filter(News.rss_source_id == source_id)
    return query.order_by(News.created_at.desc()).limit(limit).all()


@router.post("/fetch")
def fetch_news(db: Session = Depends(get_db)):
    # TODO: 实现 RSS 抓取逻辑，复用 mvp/app/services/rss.py
    return {"message": "Not implemented yet"}
