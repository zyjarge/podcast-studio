from fastapi import APIRouter
from app.api.v1.endpoints import rss_sources, news

api_router = APIRouter()
api_router.include_router(rss_sources.router, prefix="/sources", tags=["sources"])
api_router.include_router(news.router, prefix="/news", tags=["news"])
