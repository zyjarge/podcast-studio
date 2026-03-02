from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.db.models import Episode, EpisodeNews, News, NewsStatus
from app.schemas.episode import EpisodeCreate, EpisodeUpdate, EpisodeResponse
from app.schemas.episode_news import EpisodeNewsResponse, EpisodeNewsUpdate
from app.services.podcast import get_podcast_service
from typing import List, Optional
from pydantic import BaseModel
import asyncio
import logging

logger = logging.getLogger(__name__)

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
    """获取节目中的新闻列表（排除已删除的）"""
    return db.query(EpisodeNews).options(
        joinedload(EpisodeNews.news)
    ).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.deleted_at == None  # 过滤已删除的
    ).order_by(EpisodeNews.order).all()


@router.get("/{episode_id}/news/deleted")
def list_deleted_news(episode_id: int, db: Session = Depends(get_db)):
    """获取已删除的新闻列表（回收站）"""
    return db.query(EpisodeNews).options(
        joinedload(EpisodeNews.news)
    ).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.deleted_at != None
    ).order_by(EpisodeNews.deleted_at.desc()).all()


@router.post("/{episode_id}/news/{news_id}/soft-delete")
def soft_delete_episode_news(episode_id: int, news_id: int, db: Session = Depends(get_db)):
    """软删除新闻到回收站"""
    episode_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.news_id == news_id
    ).first()
    
    if not episode_news:
        raise HTTPException(status_code=404, detail="News not found in episode")
    
    from datetime import datetime
    episode_news.deleted_at = datetime.utcnow()
    db.commit()
    
    return {"message": "已移到回收站", "deleted_at": episode_news.deleted_at}


@router.post("/{episode_id}/news/{news_id}/restore")
def restore_episode_news(episode_id: int, news_id: int, db: Session = Depends(get_db)):
    """从回收站恢复新闻"""
    episode_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.news_id == news_id,
        EpisodeNews.deleted_at != None
    ).first()
    
    if not episode_news:
        raise HTTPException(status_code=404, detail="Deleted news not found in episode")
    
    episode_news.deleted_at = None
    db.commit()
    
    return {"message": "已恢复"}


@router.delete("/{episode_id}/news/{news_id}/permanent")
def permanent_delete_episode_news(episode_id: int, news_id: int, db: Session = Depends(get_db)):
    """永久删除新闻"""
    episode_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.news_id == news_id,
        EpisodeNews.deleted_at != None
    ).first()
    
    if not episode_news:
        raise HTTPException(status_code=404, detail="Deleted news not found")
    
    db.delete(episode_news)
    db.commit()
    
    return {"message": "已永久删除"}


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


@router.put("/{episode_id}/news/{news_id}/script")
def update_script(
    episode_id: int,
    news_id: int,
    script: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Update the script for a specific news item (inline editing)
    """
    episode_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.news_id == news_id
    ).first()
    
    if not episode_news:
        raise HTTPException(status_code=404, detail="News not found in episode")
    
    episode_news.script = script
    db.commit()
    db.refresh(episode_news)
    
    logger.info(f"Updated script for news {news_id}")
    
    return {"script": episode_news.script, "status": episode_news.status.value}


@router.post("/{episode_id}/news/{news_id}/generate-script")
async def generate_script(
    episode_id: int,
    news_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate script for a specific news item in an episode using DeepSeek LLM
    """
    episode_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.news_id == news_id
    ).first()
    
    if not episode_news:
        raise HTTPException(status_code=404, detail="News not found in episode")
    
    # Get the news content
    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    
    # Update status to generating
    episode_news.status = NewsStatus.GENERATING
    db.commit()
    
    try:
        # Get podcast service
        podcast_service = get_podcast_service()
        
        # Use custom prompt if available, otherwise use default
        role_prompt = episode_news.prompt or ""
        
        # Generate script using LLM
        news_content = news.content or news.summary or news.title
        logger.info(f"Generating script for news {news_id}, content length: {len(news_content)}")
        
        script = await podcast_service.generate_script(
            news_content=news_content,
            role_prompt=role_prompt
        )
        
        logger.info(f"Script generated successfully, length: {len(script)}")
        
        episode_news.script = script
        episode_news.status = NewsStatus.SCRIPT_DONE
        db.commit()
        
        logger.info(f"Generated script for news {news_id}: {len(script)} chars")
        
        return {"script": episode_news.script, "status": episode_news.status.value}
        
    except Exception as e:
        logger.error(f"Error generating script: {e}")
        episode_news.status = NewsStatus.ERROR
        episode_news.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error generating script: {str(e)}")


@router.post("/{episode_id}/news/{news_id}/generate-audio")
async def generate_audio(
    episode_id: int,
    news_id: int,
    voice_id: str = "luoyonghao",
    db: Session = Depends(get_db)
):
    """
    Generate audio for a specific news item in an episode using MiniMax TTS
    """
    episode_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.news_id == news_id
    ).first()
    
    if not episode_news:
        raise HTTPException(status_code=404, detail="News not found in episode")
    
    if not episode_news.script:
        raise HTTPException(status_code=400, detail="Script not generated yet")
    
    # Update status to generating
    episode_news.status = NewsStatus.GENERATING
    db.commit()
    
    try:
        # Get podcast service
        podcast_service = get_podcast_service()
        
        # Generate audio using TTS
        audio_path = await podcast_service.generate_audio(
            script=episode_news.script,
            voice_id=voice_id
        )
        
        episode_news.status = NewsStatus.AUDIO_DONE
        episode_news.audio_url = audio_path
        db.commit()
        
        logger.info(f"Generated audio for news {news_id}: {audio_path}")
        
        return {"audio_url": episode_news.audio_url, "status": episode_news.status.value}
        
    except Exception as e:
        logger.error(f"Error generating audio: {e}")
        episode_news.status = NewsStatus.ERROR
        episode_news.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error generating audio: {str(e)}")


@router.post("/{episode_id}/generate-all")
async def generate_all(
    episode_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate script and audio for all pending news in an episode
    """
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    pending_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.status == NewsStatus.PENDING
    ).all()
    
    results = []
    podcast_service = get_podcast_service()
    
    for en in pending_news:
        try:
            # Get news content
            news = db.query(News).filter(News.id == en.news_id).first()
            if not news:
                continue
            
            # Generate script
            en.status = NewsStatus.GENERATING
            db.commit()
            
            news_content = news.content or news.summary or news.title
            script = await podcast_service.generate_script(news_content=news_content)
            en.script = script
            en.status = NewsStatus.SCRIPT_DONE
            db.commit()
            
            # Generate audio
            en.status = NewsStatus.GENERATING
            db.commit()
            
            audio_path = await podcast_service.generate_audio(script=script)
            en.status = NewsStatus.AUDIO_DONE
            en.audio_url = audio_path
            db.commit()
            
            results.append({"news_id": en.news_id, "status": en.status.value})
            
        except Exception as e:
            logger.error(f"Error generating for news {en.news_id}: {e}")
            en.status = NewsStatus.ERROR
            en.error_message = str(e)
            db.commit()
            results.append({"news_id": en.news_id, "status": "error", "error": str(e)})
    
    return {"generated": len(results), "results": results}


class BatchGenerateRequest(BaseModel):
    """批量生成请求"""
    episode_news_ids: List[int]  # EpisodeNews 的 ID 列表
    action: str = "all"  # "script" | "audio" | "all"


@router.post("/{episode_id}/batch-generate")
async def batch_generate(
    episode_id: int,
    request: BatchGenerateRequest,
    db: Session = Depends(get_db)
):
    """
    批量生成脚本和音频
    - action="script": 只生成脚本
    - action="audio": 只生成音频（需要已有脚本）
    - action="all": 生成脚本+音频
    """
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    
    # 获取要生成的新闻
    episode_news_list = db.query(EpisodeNews).filter(
        EpisodeNews.id.in_(request.episode_news_ids)
    ).all()
    
    if not episode_news_list:
        raise HTTPException(status_code=404, detail="No episode news found")
    
    results = []
    podcast_service = get_podcast_service()
    
    for en in episode_news_list:
        try:
            news = db.query(News).filter(News.id == en.news_id).first()
            if not news:
                continue
            
            # 生成脚本
            if request.action in ("script", "all"):
                en.status = NewsStatus.GENERATING
                db.commit()
                
                news_content = news.content or news.summary or news.title
                script = await podcast_service.generate_script(news_content=news_content)
                en.script = script
                en.status = NewsStatus.SCRIPT_DONE
                db.commit()
            
            # 生成音频
            if request.action in ("audio", "all"):
                # 如果没有脚本，先生成脚本
                if not en.script:
                    en.status = NewsStatus.GENERATING
                    db.commit()
                    news_content = news.content or news.summary or news.title
                    script = await podcast_service.generate_script(news_content=news_content)
                    en.script = script
                    en.status = NewsStatus.SCRIPT_DONE
                    db.commit()
                
                en.status = NewsStatus.GENERATING
                db.commit()
                
                audio_path = await podcast_service.generate_audio(script=en.script)
                en.audio_url = audio_path
                en.status = NewsStatus.AUDIO_DONE
                db.commit()
            
            results.append({
                "episode_news_id": en.id,
                "news_id": en.news_id,
                "status": en.status.value,
                "action": request.action
            })
            
        except Exception as e:
            logger.error(f"Error generating for news {en.news_id}: {e}")
            en.status = NewsStatus.ERROR
            en.error_message = str(e)
            db.commit()
            results.append({
                "episode_news_id": en.id,
                "news_id": en.news_id,
                "status": "error",
                "error": str(e)
            })
    
    return {
        "total": len(results),
        "success": sum(1 for r in results if r.get("status") != "error"),
        "results": results
    }
