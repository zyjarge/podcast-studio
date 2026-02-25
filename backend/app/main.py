from fastapi import FastAPI
from app.core.config import settings
from app.db.session import engine, Base
from app.db import models  # noqa: F401
from app.api.v1.router import api_router

app = FastAPI(title="Podcast Studio API")

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}
