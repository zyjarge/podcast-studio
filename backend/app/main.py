from fastapi import FastAPI
from app.core.config import settings
from app.db.session import engine, Base

app = FastAPI(title="Podcast Studio API")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}
