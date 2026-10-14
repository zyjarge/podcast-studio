from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import News, RSSSource
from app.schemas.news import NewsResponse
from app.services.news_scorer import NewsScorer
from app.services.podcast import get_podcast_service
from app.services.llm import TOPIC_CLUSTER_PROMPT, extract_json_array
from typing import List
from collections import Counter
import asyncio
import json
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


_SORT_COLUMN = {
    "created_at": News.created_at,
    "updated_at": News.updated_at,
    "score": News.score,
}


@router.get("/", response_model=List[NewsResponse])
def list_news(
    source_id: int | None = None,
    limit: int = 100,
    sort_by: str = "created_at",  # created_at, score, updated_at
    order: str = "desc",
    min_score: float | None = Query(None, ge=0, le=100),
    db: Session = Depends(get_db),
):
    """
    获取新闻列表。纯读 GET,不带副作用。

    Issue #12: 旧实现会在 GET 路径里给缺失评分的新闻打分数并 commit。
    GET-as-POST 违反 REST/HTTP 语义,会让任何缓存层(CDN / browser
    prefetch / HTTP accelerator)反复重放评分副作用,且 score_updated_at
    会被频繁踩踏。打分请走 POST /news/score-all(已存在)。

    sort_by / order 这块旧版有一串 if-ladder 把同一映射写了两遍
    (order_col = ... 然后又把 query.order_by(...) 重写一遍),是死代码;
    改成一个 _SORT_COLUMN 表直接 order_by。
    """
    query = db.query(News)

    if source_id:
        query = query.filter(News.rss_source_id == source_id)
    if min_score is not None:
        query = query.filter(News.score >= min_score)

    col = _SORT_COLUMN.get(sort_by, News.created_at)
    query = query.order_by(col.desc() if order == "desc" else col.asc())

    news_list = query.limit(limit).all()

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
                        content=item.content if hasattr(item, 'content') else item.get('content', ''),
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


# ===== 话题聚类 =====


def _parse_keywords(raw) -> list:
    """解析 News.keywords。该列是 JSON 类型，正常返回 list；防御历史数据里混入 JSON 字符串的情况"""
    if isinstance(raw, list):
        kws = raw
    elif isinstance(raw, str):
        try:
            kws = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            kws = []
    else:
        kws = []
    if not isinstance(kws, list):
        return []
    return [str(k).strip() for k in kws if str(k).strip()]


def _cluster_topics_with_llm(news_list) -> list:
    """调用 LLM 按话题聚类。LLM 不可用或输出无法解析时抛异常，由调用方降级"""
    service = get_podcast_service()
    if not service.llm:
        raise RuntimeError("LLM service not initialized. Please set DEEPSEEK_API_KEY")

    news_lines = []
    for n in news_list:
        summary = (n.summary or "").strip().replace("\n", " ")[:100]
        news_lines.append(f"{n.id}: {n.title} — {summary}")
    prompt = TOPIC_CLUSTER_PROMPT.format(news_text="\n".join(news_lines))

    response = service.llm.generate(prompt=prompt, max_tokens=2048, temperature=0.3)

    data = extract_json_array(response.text)
    if not isinstance(data, list):
        raise ValueError("LLM 聚类输出不是 JSON 数组")

    valid_ids = {n.id for n in news_list}
    topics = []
    for item in data:
        if not isinstance(item, dict):
            continue
        news_ids = [
            i for i in item.get("news_ids", [])
            if isinstance(i, int) and not isinstance(i, bool) and i in valid_ids
        ]
        if not news_ids:
            continue
        topics.append({
            "title": str(item.get("title", "")).strip()[:12] or "未命名话题",
            "summary": str(item.get("summary", "")).strip()[:40],
            "news_ids": news_ids,
        })

    if not topics:
        raise ValueError("LLM 聚类输出无有效话题")
    return topics


def _cluster_topics_heuristic(news_list) -> list:
    """
    关键词重叠启发式聚类（LLM 不可用时的降级方案）：
    共享任一 keyword 的新闻用并查集归簇；话题名取组内最高频前 2 个关键词，
    summary 取组内最高分新闻的 summary；按组内最高分排序。
    """
    parent = {n.id: n.id for n in news_list}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    kw_map = {n.id: _parse_keywords(n.keywords) for n in news_list}

    # 共享任一关键词的新闻归为一簇
    kw_owner = {}
    for n in news_list:
        for kw in kw_map[n.id]:
            if kw in kw_owner:
                union(n.id, kw_owner[kw])
            else:
                kw_owner[kw] = n.id

    groups = {}
    for n in news_list:
        groups.setdefault(find(n.id), []).append(n)

    topics = []
    for members in groups.values():
        counter = Counter()
        for m in members:
            counter.update(kw_map[m.id])
        top_kws = [kw for kw, _ in counter.most_common(2)]

        best = max(members, key=lambda m: m.score or 0)
        title = " · ".join(top_kws) if top_kws else (best.title or "")[:12]
        ordered = sorted(members, key=lambda m: m.score or 0, reverse=True)

        topics.append({
            "title": title,
            "summary": best.summary or best.title or "",
            "news_ids": [m.id for m in ordered],
            "_score": best.score or 0,
        })

    # 按组内最高分排序
    topics.sort(key=lambda t: t["_score"], reverse=True)
    for t in topics:
        del t["_score"]
    return topics


@router.post("/cluster-topics")
def cluster_topics(db: Session = Depends(get_db)):
    """
    按话题聚类最近 30 条新闻（按创建时间倒序）。
    优先 LLM 聚类；LLM 不可用或输出解析失败时降级为关键词重叠启发式，
    保证永远返回结果。
    """
    news_list = db.query(News).order_by(News.created_at.desc()).limit(30).all()
    if not news_list:
        return {"topics": []}

    try:
        topics = _cluster_topics_with_llm(news_list)
        return {"topics": topics}
    except Exception as e:
        logger.warning(f"LLM 话题聚类失败，降级为关键词启发式: {e}")

    return {"topics": _cluster_topics_heuristic(news_list)}
