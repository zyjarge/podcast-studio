from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Episode, EpisodeNews, NewsStatus
from app.schemas.episode import EpisodeCreate, EpisodeUpdate, EpisodeResponse
from app.schemas.episode_news import EpisodeNewsResponse
from typing import List

router = APIRouter()


@router.get("/", response_model=List[EpisodeResponse])
def list_episodes(db: Session = Depends(get_db)):
    return db.query(Episode).order_by(Episode.created_at.desc()).all()


@router.post("/", response_model=EpisodeResponse)
def create_episode(episode: EpisodeCreate, db: Session = Depends(get_db)):
    db_episode = Episode(**episode.model_dump())
    db.add(db_episode)
    db.commit()
    db.refresh(db_episode)
    return db_episode


@router.get("/{episode_id}", response_model=EpisodeResponse)
def get_episode(episode_id: int, db: Session = Depends(get_db)):
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode


@router.put("/{episode_id}", response_model=EpisodeResponse)
def update_episode(episode_id: int, episode: EpisodeUpdate, db: Session = Depends(get_db)):
    db_episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not db_episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    for key, value in episode.model_dump(exclude_unset=True).items():
        setattr(db_episode, key, value)
    db.commit()
    db.refresh(db_episode)
    return db_episode


@router.delete("/{episode_id}")
def delete_episode(episode_id: int, db: Session = Depends(get_db)):
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    db.delete(episode)
    db.commit()
    return {"ok": True}


@router.get("/{episode_id}/news", response_model=List[EpisodeNewsResponse])
def list_episode_news(episode_id: int, db: Session = Depends(get_db)):
    return db.query(EpisodeNews).filter(EpisodeNews.episode_id == episode_id).order_by(EpisodeNews.order).all()


@router.post("/{episode_id}/news")
def add_news_to_episode(episode_id: int, news_ids: List[int], db: Session = Depends(get_db)):
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    max_order = db.query(EpisodeNews).filter(EpisodeNews.episode_id == episode_id).count()

    for i, news_id in enumerate(news_ids):
        existing = db.query(EpisodeNews).filter(
            EpisodeNews.episode_id == episode_id,
            EpisodeNews.news_id == news_id
        ).first()
        if not existing:
            en = EpisodeNews(episode_id=episode_id, news_id=news_id, order=max_order + i)
            db.add(en)

    db.commit()
    return {"ok": True}


@router.put("/{episode_id}/news/reorder")
def reorder_episode_news(episode_id: int, news_orders: List[dict], db: Session = Depends(get_db)):
    for item in news_orders:
        en = db.query(EpisodeNews).filter(
            EpisodeNews.episode_id == episode_id,
            EpisodeNews.id == item["id"]
        ).first()
        if en:
            en.order = item["order"]
    db.commit()
    return {"ok": True}
