from fastapi import APIRouter
from app.api.v1.endpoints import rss_sources

api_router = APIRouter()
api_router.include_router(rss_sources.router, prefix="/sources", tags=["sources"])
