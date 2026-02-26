from fastapi import APIRouter
from app.api.v1.endpoints import rss_sources, news, episodes, rss_parser, settings

api_router = APIRouter()
api_router.include_router(rss_sources.router, prefix="/sources", tags=["sources"])
api_router.include_router(news.router, prefix="/news", tags=["news"])
api_router.include_router(episodes.router, prefix="/episodes", tags=["episodes"])
api_router.include_router(rss_parser.router, prefix="/rss", tags=["rss"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
