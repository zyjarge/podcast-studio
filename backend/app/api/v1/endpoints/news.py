from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import News, RSSSource
from app.schemas.news import NewsResponse
from app.services.news_scorer import NewsScorer
from typing import List
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{news_id}", response_model=NewsResponse)
def get_news(news_id: int, db: Session = Depends(get_db)):
    """获取单条新闻"""
    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    return news


@router.get("/", response_model=List[NewsResponse])
def list_news(
    source_id: int | None = None,
    limit: int = 100,
    sort_by: str = "created_at",  # created_at, score, updated
    order: str = "desc",
    min_score: float | None = Query(None, ge=0, le=100),
    db: Session = Depends(get_db)
):
    """
    获取新闻列表
    
    Args:
        source_id: RSS 源 ID 筛选
        limit: 返回数量
        sort_by: 排序字段 (created_at, score, updated_at)
        order: 排序方向 (asc, desc)
        min_score: 最低评分筛选
    """
    query = db.query(News)
    
    # 筛选
    if source_id:
        query = query.filter(News.rss_source_id == source_id)
    if min_score is not None:
        query = query.filter(News.score >= min_score)
    
    # 排序
    if sort_by == "score":
        order_col = News.score if order == "desc" else News.score
    elif sort_by == "updated_at":
        order_col = News.updated_at if order == "desc" else News.updated_at.asc()
    else:
        order_col = News.created_at if order == "desc" else News.created_at.asc()
    
    # 如果是升序，需要特殊处理
    if order == "asc":
        if sort_by == "score":
            query = query.order_by(News.score.asc())
        elif sort_by == "updated_at":
            query = query.order_by(News.updated_at.asc())
        else:
            query = query.order_by(News.created_at.asc())
    else:
        if sort_by == "score":
            query = query.order_by(News.score.desc())
        elif sort_by == "updated_at":
            query = query.order_by(News.updated_at.desc())
        else:
            query = query.order_by(News.created_at.desc())
    
    news_list = query.limit(limit).all()
    
    # 为没有评分的新闻计算评分
    scorer = NewsScorer(db)
    for news in news_list:
        if news.score is None or news.score == 0:
            scores = scorer.score_news(news)
            news.score = scores["score"]
            news.score_authority = scores["score_authority"]
            news.score_timeliness = scores["score_timeliness"]
            news.score_depth = scores["score_depth"]
            news.score_updated_at = scores["score_updated_at"]
    
    # 如果有无评分的，提交保存
    db.commit()
    
    return news_list


@router.post("/score-all")
def score_all_news(limit: int = 100, db: Session = Depends(get_db)):
    """批量评分所有新闻"""
    scorer = NewsScorer(db)
    count = scorer.score_all_news(limit)
    return {"message": f"完成 {count} 条新闻评分"}


@router.post("/fetch")
async def fetch_news(source_id: int | None = None, db: Session = Depends(get_db)):
    """抓取 RSS 源新闻"""
    try:
        # 导入 RSS 服务
        from app.services.rss import RSSService
        
        rss_service = RSSService()
        
        # 获取要抓取的源
        if source_id:
            sources = db.query(RSSSource).filter(RSSSource.id == source_id, RSSSource.enabled == True).all()
        else:
            sources = db.query(RSSSource).filter(RSSSource.enabled == True).all()
        
        if not sources:
            raise HTTPException(status_code=404, detail="没有找到启用的 RSS 源")
        
        new_news_count = 0
        scorer = NewsScorer(db)
        
        for source in sources:
            try:
                # 抓取新闻
                items = await rss_service.fetch(source.url, limit=20)
                
                for item in items:
                    # 检查是否已存在（通过 URL）
                    item_url = item.url if hasattr(item, 'url') else item.get('url', '')
                    existing = db.query(News).filter(News.url == item_url).first()
                    if existing:
                        continue
                    
                    # 创建新闻记录
                    news = News(
                        title=item.title if hasattr(item, 'title') else item.get('title', ''),
                        source=source.name,
                        url=item_url,
                        summary=item.summary if hasattr(item, 'summary') else item.get('summary', ''),
                        keywords=[],
                        content=item.summary if hasattr(item, 'summary') else item.get('summary', ''),
                        rss_source_id=source.id
                    )
                    
                    # 计算评分
                    scores = scorer.score_news(news)
                    news.score = scores["score"]
                    news.score_authority = scores["score_authority"]
                    news.score_timeliness = scores["score_timeliness"]
                    news.score_depth = scores["score_depth"]
                    news.score_updated_at = scores["score_updated_at"]
                    
                    db.add(news)
                    new_news_count += 1
                
                db.commit()
                logger.info(f"从 {source.name} 抓取了 {len(items)} 条新闻")
                
            except Exception as e:
                logger.error(f"抓取 {source.name} 失败: {e}")
                continue
        
        return {"message": f"抓取完成，新增 {new_news_count} 条新闻"}
        
    except Exception as e:
        logger.error(f"抓取新闻失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
