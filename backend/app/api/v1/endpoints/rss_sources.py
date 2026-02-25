from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import RSSSource
from app.schemas.rss_source import RSSSourceCreate, RSSSourceUpdate, RSSSourceResponse
from typing import List

router = APIRouter()


@router.get("/", response_model=List[RSSSourceResponse])
def list_sources(db: Session = Depends(get_db)):
    return db.query(RSSSource).all()


@router.post("/", response_model=RSSSourceResponse)
def create_source(source: RSSSourceCreate, db: Session = Depends(get_db)):
    db_source = RSSSource(**source.model_dump())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


@router.get("/{source_id}", response_model=RSSSourceResponse)
def get_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(RSSSource).filter(RSSSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.put("/{source_id}", response_model=RSSSourceResponse)
def update_source(source_id: int, source: RSSSourceUpdate, db: Session = Depends(get_db)):
    db_source = db.query(RSSSource).filter(RSSSource.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Source not found")
    for key, value in source.model_dump(exclude_unset=True).items():
        setattr(db_source, key, value)
    db.commit()
    db.refresh(db_source)
    return db_source


@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(RSSSource).filter(RSSSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return {"ok": True}
