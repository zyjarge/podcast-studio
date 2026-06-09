from fastapi import APIRouter, Depends, HTTPException, Body, BackgroundTasks
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


@router.post("/batch-delete")
def batch_delete_episodes(episode_ids: List[int], db: Session = Depends(get_db)):
    """批量删除节目"""
    episodes = db.query(Episode).filter(Episode.id.in_(episode_ids)).all()
    if not episodes:
        raise HTTPException(status_code=404, detail="No episodes found")
    for ep in episodes:
        db.delete(ep)
    db.commit()
    return {"ok": True, "deleted_count": len(episodes)}


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


@router.put("/{episode_id}/news/{news_id}/notes")
def update_notes(
    episode_id: int,
    news_id: int,
    notes: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Update notes for a specific news item (guides LLM focus)
    """
    episode_news = db.query(EpisodeNews).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.news_id == news_id
    ).first()
    
    if not episode_news:
        raise HTTPException(status_code=404, detail="News not found in episode")
    
    episode_news.notes = notes
    db.commit()
    db.refresh(episode_news)
    
    logger.info(f"Updated notes for news {news_id}")
    
    return {"notes": episode_news.notes}


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


class GenerateEpisodeScriptRequest(BaseModel):
    """整期逐字稿生成请求"""
    episode_notes: str = ""  # 节目级备注


@router.post("/{episode_id}/generate-episode-script")
async def generate_episode_script(
    episode_id: int,
    request: GenerateEpisodeScriptRequest = GenerateEpisodeScriptRequest(),
    db: Session = Depends(get_db)
):
    """
    Generate a full episode podcast script from all news in the episode.
    Combines all news summaries + per-news notes + episode notes into one prompt.
    """
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    # Get all non-deleted news in this episode
    episode_news_list = db.query(EpisodeNews).options(
        joinedload(EpisodeNews.news)
    ).filter(
        EpisodeNews.episode_id == episode_id,
        EpisodeNews.deleted_at == None
    ).order_by(EpisodeNews.order).all()

    if not episode_news_list:
        raise HTTPException(status_code=400, detail="No news in this episode")

    # Build news items list with notes
    news_items = []
    for en in episode_news_list:
        news = en.news
        if not news:
            continue
        news_items.append({
            "title": news.title or "",
            "summary": news.summary or "",
            "content": news.content or "",
            "notes": en.notes or "",
        })

    try:
        podcast_service = get_podcast_service()

        script = await podcast_service.generate_episode_script(
            news_items=news_items,
            episode_notes=request.episode_notes
        )

        # Save script to episode
        episode.script = script
        db.commit()

        logger.info(f"Generated episode script for episode {episode_id}: {len(script)} chars")

        return {
            "script": script,
            "news_count": len(news_items),
            "char_count": len(script)
        }

    except Exception as e:
        logger.error(f"Error generating episode script: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating episode script: {str(e)}")


# ===== Audio generation with progress tracking =====

# In-memory progress store: {episode_id: {stage, total, completed, message, audio_url, error}}
_audio_progress: dict[int, dict] = {}


def _get_audio_progress(episode_id: int) -> dict:
    """Get audio generation progress for an episode."""
    return _audio_progress.get(episode_id, {
        "stage": "idle",
        "total": 0,
        "completed": 0,
        "message": "",
        "audio_url": "",
        "error": ""
    })


def _update_audio_progress(episode_id: int, **kwargs):
    """Update audio generation progress."""
    if episode_id not in _audio_progress:
        _audio_progress[episode_id] = _get_audio_progress(episode_id)
    _audio_progress[episode_id].update(kwargs)


def _run_audio_generation(episode_id: int, script: str):
    """Background task: generate audio from script."""
    import os
    import time
    from app.services.tts import MiniMaxTTSService

    try:
        _update_audio_progress(episode_id, stage="parsing", message="解析逐字稿中...")

        tts = MiniMaxTTSService()
        dialogues = tts.parse_script(script)

        if not dialogues:
            _update_audio_progress(episode_id, stage="error", error="未找到对话内容")
            return

        luo_count = sum(1 for d in dialogues if d.speaker == "luoyonghao")
        wang_count = sum(1 for d in dialogues if d.speaker == "wangziru")
        total = len(dialogues)

        _update_audio_progress(
            episode_id,
            stage="submitting",
            total=total,
            completed=0,
            message=f"解析到 {total} 段对话 (彪悍罗: {luo_count}, OK王: {wang_count})，提交任务中..."
        )

        # Output directory
        output_dir = f"data/audio/episode_{episode_id}"
        splits_dir = os.path.join(output_dir, "splits")
        os.makedirs(splits_dir, exist_ok=True)

        # Use batch_generate with progress callback
        # Since batch_generate doesn't support callbacks, we'll run stages manually
        from concurrent.futures import ThreadPoolExecutor, as_completed
        import threading

        # Stage 1: Submit tasks
        tasks = []
        semaphore = threading.Semaphore(tts.max_concurrent)

        def submit_task(d):
            with semaphore:
                result = tts._upload_and_create_task(d.text, d.speaker, d.index)
                return result

        with ThreadPoolExecutor(max_workers=tts.max_concurrent) as executor:
            futures = {executor.submit(submit_task, d): d for d in dialogues}
            for future in as_completed(futures):
                d = futures[future]
                try:
                    result = future.result()
                    tasks.append(result)
                    _update_audio_progress(
                        episode_id,
                        stage="submitting",
                        completed=len(tasks),
                        message=f"提交任务 {len(tasks)}/{total}..."
                    )
                except Exception as e:
                    logger.error(f"Submit task failed for {d.index}: {e}")

        tasks.sort(key=lambda x: x["index"])
        _update_audio_progress(
            episode_id,
            stage="processing",
            completed=0,
            total=len(tasks),
            message=f"已提交 {len(tasks)} 个任务，等待生成中..."
        )

        # Stage 2: Wait for completion
        completed_tasks = []
        failed_tasks = []
        lock = threading.Lock()
        polling_count = [0]  # mutable counter for active polling threads

        def wait_task(task):
            task_id = task["task_id"]
            idx = task["index"]
            with lock:
                polling_count[0] += 1
            try:
                # Update message to show which tasks are being polled
                with lock:
                    _update_audio_progress(
                        episode_id,
                        stage="processing",
                        completed=len(completed_tasks),
                        message=f"等待 MiniMax 生成中... ({len(completed_tasks)}/{len(tasks)} 完成, {polling_count[0]} 个任务查询中)"
                    )

                file_id = tts._wait_task(task_id)
                with lock:
                    task["file_id"] = file_id
                    completed_tasks.append(task)
                    _update_audio_progress(
                        episode_id,
                        stage="processing",
                        completed=len(completed_tasks),
                        message=f"音频生成中 {len(completed_tasks)}/{len(tasks)}..."
                    )
            except Exception as e:
                logger.error(f"Wait task failed for {idx}: {e}")
                with lock:
                    failed_tasks.append(task)
            finally:
                with lock:
                    polling_count[0] -= 1

        with ThreadPoolExecutor(max_workers=tts.max_concurrent) as executor:
            executor.map(wait_task, tasks)

        _update_audio_progress(
            episode_id,
            stage="downloading",
            completed=0,
            total=len(completed_tasks),
            message=f"下载音频中..."
        )

        # Stage 3: Download
        audio_parts = []
        lock2 = threading.Lock()

        def download_task(task):
            idx = task["index"]
            file_id = task.get("file_id")
            if not file_id:
                return
            try:
                audio = tts._download_audio(file_id)
                path = os.path.join(splits_dir, f"part_{idx+1:03d}.mp3")
                with open(path, "wb") as f:
                    f.write(audio)
                with lock2:
                    audio_parts.append(path)
                    _update_audio_progress(
                        episode_id,
                        stage="downloading",
                        completed=len(audio_parts),
                        message=f"下载音频 {len(audio_parts)}/{len(completed_tasks)}..."
                    )
            except Exception as e:
                logger.error(f"Download failed for {idx}: {e}")

        with ThreadPoolExecutor(max_workers=tts.max_concurrent) as executor:
            executor.map(download_task, completed_tasks)

        audio_parts.sort()

        # Stage 4: Merge
        _update_audio_progress(episode_id, stage="merging", message="合并音频中...")

        final_path = os.path.join(output_dir, f"episode_{episode_id}.mp3")
        success = tts.merge_audio(audio_parts, final_path, skip_existing=False)

        if success:
            _update_audio_progress(
                episode_id,
                stage="done",
                message="音频生成完成!",
                audio_url=final_path
            )
            # Save audio_url to database
            try:
                from app.db.session import SessionLocal
                from app.db.models.episode import Episode
                db = SessionLocal()
                episode = db.query(Episode).filter(Episode.id == episode_id).first()
                if episode:
                    episode.audio_url = final_path
                    db.commit()
                    logger.info(f"Saved audio_url to database for episode {episode_id}")
                db.close()
            except Exception as e:
                logger.error(f"Failed to save audio_url to database: {e}")

            logger.info(f"Audio generated for episode {episode_id}: {final_path}")
        else:
            _update_audio_progress(episode_id, stage="error", error="音频合并失败")

    except Exception as e:
        logger.error(f"Audio generation failed for episode {episode_id}: {e}")
        _update_audio_progress(episode_id, stage="error", error=str(e))


@router.post("/{episode_id}/generate-episode-audio")
async def generate_episode_audio(
    episode_id: int,
    background_tasks: BackgroundTasks,
    force: bool = False,
    db: Session = Depends(get_db)
):
    """
    Start audio generation for an episode (background task).
    Use GET /{episode_id}/audio-progress to check progress.
    """
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    if not episode.script:
        raise HTTPException(status_code=400, detail="Episode has no script. Generate script first.")

    # Check if already running (unless force=True)
    progress = _get_audio_progress(episode_id)
    if not force and progress["stage"] in ("parsing", "submitting", "processing", "downloading", "merging"):
        raise HTTPException(status_code=409, detail="Audio generation already in progress")

    # Reset progress
    _update_audio_progress(
        episode_id,
        stage="starting",
        total=0,
        completed=0,
        message="开始生成音频...",
        audio_url="",
        error=""
    )

    # Start background task
    background_tasks.add_task(_run_audio_generation, episode_id, episode.script)

    return {"message": "Audio generation started", "episode_id": episode_id}


@router.get("/{episode_id}/audio-progress")
def get_audio_progress(episode_id: int, db: Session = Depends(get_db)):
    """
    Get audio generation progress for an episode.
    Poll this endpoint to track generation status.

    Stages: idle -> starting -> parsing -> submitting -> processing -> downloading -> merging -> done
    """
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    progress = _get_audio_progress(episode_id)

    # Calculate percentage
    if progress["total"] > 0:
        if progress["stage"] == "done":
            progress["percent"] = 100
        elif progress["stage"] in ("submitting", "processing", "downloading"):
            progress["percent"] = int((progress["completed"] / progress["total"]) * 100)
        else:
            progress["percent"] = 0
    else:
        progress["percent"] = 0

    return progress


# ===== Testing endpoint =====

@router.post("/{episode_id}/inject-test-script")
async def inject_test_script(episode_id: int, db: Session = Depends(get_db)):
    """
    Inject a minimal test script for debugging audio generation.
    Just two lines: one person says hello, the other says welcome.
    """
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    test_script = """大家好，欢迎收听本期节目。

**OK王：** 老罗，今天天气不错，咱们来聊聊科技新闻吧。

**彪悍罗：** 没错自如，今天确实有不少好话题。咱们直接开始！"""

    episode.script = test_script
    db.commit()

    return {"script": test_script, "char_count": len(test_script)}


# ===== Audio management =====

@router.delete("/{episode_id}/audio")
def delete_episode_audio(episode_id: int, db: Session = Depends(get_db)):
    """
    Delete generated audio for an episode.
    Removes the audio file from disk and clears audio_url in database.
    """
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    if not episode.audio_url:
        raise HTTPException(status_code=400, detail="No audio to delete")

    # Delete file from disk
    audio_path = episode.audio_url
    deleted_files = []
    if os.path.exists(audio_path):
        os.remove(audio_path)
        deleted_files.append(audio_path)

    # Also delete splits directory
    splits_dir = os.path.join(os.path.dirname(audio_path), "splits")
    if os.path.exists(splits_dir):
        import shutil
        shutil.rmtree(splits_dir, ignore_errors=True)
        deleted_files.append(splits_dir)

    # Clear audio_url in database
    episode.audio_url = ""
    db.commit()

    # Reset progress
    _audio_progress.pop(episode_id, None)

    logger.info(f"Deleted audio for episode {episode_id}: {deleted_files}")

    return {"message": "Audio deleted", "deleted_files": deleted_files}
