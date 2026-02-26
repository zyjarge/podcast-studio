from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import News, RSSSource
from app.schemas.news import NewsResponse
from typing import List
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[NewsResponse])
def list_news(source_id: int | None = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(News)
    if source_id:
        query = query.filter(News.rss_source_id == source_id)
    return query.order_by(News.created_at.desc()).limit(limit).all()


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
        
        for source in sources:
            try:
                # 抓取新闻
                items = await rss_service.fetch(source.url, limit=20)
                
                for item in items:
                    # 检查是否已存在（通过 URL）
                    # item 是 RSSItem 对象，需要用属性访问
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
