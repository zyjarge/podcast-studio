# Backend API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建 Podcast Studio 后端 API 系统，支持前端 8 个页面的数据交互

**Architecture:** FastAPI + SQLAlchemy 2.0 + SQLite，复用 MVP 的 LangGraph pipeline 作为播客生成引擎

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, Python 3.10+

---

## 项目初始化

### Task 1: 创建后端项目结构

**Files:**

- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/session.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/services/__init__.py`

**Step 1: 创建 requirements.txt**

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
pydantic==2.5.3
pydantic-settings==2.1.0
alembic==1.13.1
python-dotenv==1.0.0
httpx==0.26.0
```

**Step 2: 创建目录结构**

```bash
mkdir -p backend/app/{core,db,api/v1/endpoints,schemas,services}
mkdir -p backend/alembic/versions
```

**Step 3: 创建 config.py**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./podcast_studio.db"
    API_V1_PREFIX: str = "/api/v1"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

**Step 4: 创建 main.py**

```python
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
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: init backend project structure"
```

---

### Task 2: 数据库模型定义

**Files:**

- Create: `backend/app/db/models/rss_source.py`
- Create: `backend/app/db/models/news.py`
- Create: `backend/app/db/models/episode.py`
- Create: `backend/app/db/models/episode_news.py`
- Create: `backend/app/db/models/__init__.py`

**Step 1: Write the failing test**

```python
# tests/test_models.py
from app.db.models import RSSSource, News, Episode

def test_rss_source_model():
    assert hasattr(RSSSource, 'id')
    assert hasattr(RSSSource, 'name')
    assert hasattr(RSSSource, 'url')
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -c "from app.db.models import RSSSource"
# Expected: ImportError (module not found)
```

**Step 3: Write models**

```python
# backend/app/db/models/rss_source.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class RSSSource(Base):
    __tablename__ = "rss_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    auto_mode = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    news = relationship("News", back_populates="rss_source")
```

```python
# backend/app/db/models/news.py
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime

class News(Base):
    __tablename__ = "news"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    source = Column(String)
    url = Column(String, nullable=False)
    summary = Column(Text)
    keywords = Column(JSON, default=list)
    content = Column(Text)
    rss_source_id = Column(Integer, ForeignKey("rss_sources.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    rss_source = relationship("RSSSource", back_populates="news")
    episode_news = relationship("EpisodeNews", back_populates="news")
```

```python
# backend/app/db/models/episode.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import enum

class EpisodeStatus(str, enum.Enum):
    DRAFT = "draft"
    EDITING = "editing"
    PUBLISHED = "published"

class Episode(Base):
    __tablename__ = "episodes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    status = Column(SQLEnum(EpisodeStatus), default=EpisodeStatus.DRAFT)
    intro_template = Column(Text, default="")
    outro_template = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    episode_news = relationship("EpisodeNews", back_populates="episode")
```

```python
# backend/app/db/models/episode_news.py
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base
from datetime import datetime
import enum

class NewsStatus(str, enum.Enum):
    PENDING = "pending"
    GENERATING = "generating"
    SCRIPT_DONE = "script_done"
    AUDIO_DONE = "audio_done"
    ERROR = "error"

class EpisodeNews(Base):
    __tablename__ = "episode_news"
    
    id = Column(Integer, primary_key=True, index=True)
    episode_id = Column(Integer, ForeignKey("episodes.id"))
    news_id = Column(Integer, ForeignKey("news.id"))
    order = Column(Integer, default=0)
    status = Column(SQLEnum(NewsStatus), default=NewsStatus.PENDING)
    prompt = Column(Text, default="")
    script = Column(Text, default="")
    audio_url = Column(String, default="")
    error_message = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    episode = relationship("Episode", back_populates="episode_news")
    news = relationship("News", back_populates="episode_news")
```

```python
# backend/app/db/models/__init__.py
from app.db.models.rss_source import RSSSource
from app.db.models.news import News
from app.db.models.episode import Episode, EpisodeStatus
from app.db.models.episode_news import EpisodeNews, NewsStatus

__all__ = ["RSSSource", "News", "Episode", "EpisodeNews", "EpisodeStatus", "NewsStatus"]
```

**Step 4: Run test to verify**

```bash
cd backend && python -c "from app.db.models import RSSSource, News, Episode, EpisodeNews; print('OK')"
# Expected: OK
```

**Step 5: Commit**

```bash
git add backend/app/db/models/
git commit -m "feat: add database models (RSSSource, News, Episode, EpisodeNews)"
```

---

### Task 3: Pydantic Schemas

**Files:**

- Create: `backend/app/schemas/rss_source.py`
- Create: `backend/app/schemas/news.py`
- Create: `backend/app/schemas/episode.py`
- Create: `backend/app/schemas/episode_news.py`

**Step 1: Write schemas**

```python
# backend/app/schemas/rss_source.py
from pydantic import BaseModel
from datetime import datetime

class RSSSourceBase(BaseModel):
    name: str
    url: str
    enabled: bool = True
    auto_mode: bool = False

class RSSSourceCreate(RSSSourceBase):
    pass

class RSSSourceUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    enabled: bool | None = None
    auto_mode: bool | None = None

class RSSSourceResponse(RSSSourceBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

```python
# backend/app/schemas/news.py
from pydantic import BaseModel
from datetime import datetime

class NewsBase(BaseModel):
    title: str
    source: str | None = None
    url: str
    summary: str | None = None
    keywords: list[str] = []

class NewsResponse(NewsBase):
    id: int
    content: str | None
    rss_source_id: int | None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

```python
# backend/app/schemas/episode.py
from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class EpisodeStatus(str, Enum):
    DRAFT = "draft"
    EDITING = "editing"
    PUBLISHED = "published"

class EpisodeBase(BaseModel):
    title: str
    intro_template: str = ""
    outro_template: str = ""

class EpisodeCreate(EpisodeBase):
    pass

class EpisodeUpdate(BaseModel):
    title: str | None = None
    status: EpisodeStatus | None = None
    intro_template: str | None = None
    outro_template: str | None = None

class EpisodeResponse(EpisodeBase):
    id: int
    status: EpisodeStatus
    created_at: datetime
    published_at: datetime | None = None
    
    class Config:
        from_attributes = True
```

```python
# backend/app/schemas/episode_news.py
from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class NewsStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    SCRIPT_DONE = "script_done"
    AUDIO_DONE = "audio_done"
    ERROR = "error"

class EpisodeNewsBase(BaseModel):
    prompt: str = ""

class EpisodeNewsCreate(EpisodeNewsBase):
    news_ids: list[int]

class EpisodeNewsUpdate(BaseModel):
    order: int | None = None
    status: NewsStatus | None = None
    prompt: str | None = None
    script: str | None = None
    audio_url: str | None = None

class EpisodeNewsResponse(EpisodeNewsBase):
    id: int
    episode_id: int
    news_id: int
    order: int
    status: NewsStatus
    script: str
    audio_url: str
    error_message: str | None
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

**Step 2: Run test**

```bash
cd backend && python -c "from app.schemas import RSSSourceCreate, NewsResponse, EpisodeResponse; print('OK')"
# Expected: OK
```

**Step 3: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add pydantic schemas"
```

---

### Task 4: RSS Source API

**Files:**

- Create: `backend/app/api/v1/endpoints/rss_sources.py`
- Create: `backend/app/api/v1/endpoints/__init__.py`
- Create: `backend/app/api/v1/router.py`

**Step 1: Write API**

```python
# backend/app/api/v1/endpoints/rss_sources.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import RSSSource
from app.schemas.rss_source import RSSSourceCreate, RSSSourceUpdate, RSSSourceResponse
from typing import List

router = APIRouter()

@router.get("/", response_model=List[RSSSourceResponse])
def list_sources(db: Session = Depends(get_db)):
    return db.query(RSSSource).all()

@router.post("/", response_model=RSSSourceResponse)
def create_source(source: RSSSourceCreate, db: Session = Depends(get_db)):
    db_source = RSSSource(**source.model_dump())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source

@router.get("/{source_id}", response_model=RSSSourceResponse)
def get_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(RSSSource).filter(RSSSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source

@router.put("/{source_id}", response_model=RSSSourceResponse)
def update_source(source_id: int, source: RSSSourceUpdate, db: Session = Depends(get_db)):
    db_source = db.query(RSSSource).filter(RSSSource.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Source not found")
    for key, value in source.model_dump(exclude_unset=True).items():
        setattr(db_source, key, value)
    db.commit()
    db.refresh(db_source)
    return db_source

@router.delete("/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    source = db.query(RSSSource).filter(RSSSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    return {"ok": True}
```

**Step 2: Create router**

```python
# backend/app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1.endpoints import rss_sources

api_router = APIRouter()
api_router.include_router(rss_sources.router, prefix="/sources", tags=["sources"])
```

**Step 3: Update main.py**

```python
from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI()
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
```

**Step 4: Test**

```bash
cd backend && uvicorn app.main:app --reload &
curl http://localhost:8000/api/v1/sources/
# Expected: []
```

**Step 5: Commit**

```bash
git add backend/app/api/
git commit -m "feat: add RSS source API endpoints"
```

---

### Task 5: News API

**Files:**

- Create: `backend/app/api/v1/endpoints/news.py`

**Step 1: Write API**

```python
# backend/app/api/v1/endpoints/news.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import News
from app.schemas.news import NewsResponse
from typing import List

router = APIRouter()

@router.get("/", response_model=List[NewsResponse])
def list_news(source_id: int | None = None, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(News)
    if source_id:
        query = query.filter(News.rss_source_id == source_id)
    return query.order_by(News.created_at.desc()).limit(limit).all()

@router.post("/fetch")
def fetch_news(db: Session = Depends(get_db)):
    # TODO: 实现 RSS 抓取逻辑，复用 mvp/app/services/rss.py
    return {"message": "Not implemented yet"}
```

**Step 2: Update router**

```python
# backend/app/api/v1/router.py
from app.api.v1.endpoints import rss_sources, news
api_router.include_router(news.router, prefix="/news", tags=["news"])
```

**Step 3: Commit**

```bash
git add backend/app/api/
git commit -m "feat: add news API endpoints"
```

---

### Task 6: Episode API

**Files:**

- Create: `backend/app/api/v1/endpoints/episodes.py`

**Step 1: Write API**

```python
# backend/app/api/v1/endpoints/episodes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Episode, EpisodeNews, NewsStatus
from app.schemas.episode import EpisodeCreate, EpisodeUpdate, EpisodeResponse
from app.schemas.episode_news import EpisodeNewsResponse
from typing import List

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
    return db.query(EpisodeNews).filter(EpisodeNews.episode_id == episode_id).order_by(EpisodeNews.order).all()

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
```

**Step 2: Update router**

```python
api_router.include_router(episodes.router, prefix="/episodes", tags=["episodes"])
```

**Step 3: Commit**

```bash
git add backend/app/api/
git commit -m "feat: add episode API endpoints"
```

---

### Task 7: 生成服务封装

**Files:**

- Copy: `mvp/app/services/llm.py` → `backend/app/services/llm.py`
- Copy: `mvp/app/services/tts.py` → `backend/app/services/tts.py`
- Copy: `mvp/app/services/rss.py` → `backend/app/services/rss.py`
- Create: `backend/app/services/podcast.py`

**Step 1: Copy services**

```bash
cp mvp/app/services/llm.py backend/app/services/
cp mvp/app/services/tts.py backend/app/services/
cp mvp/app/services/rss.py backend/app/services/
```

**Step 2: Create podcast service**

```python
# backend/app/services/podcast.py
class PodcastService:
    def __init__(self, llm_service, tts_service):
        self.llm = llm_service
        self.tts = tts_service
    
    async def generate_script(self, news_content: str, role_prompt: str) -> str:
        # 调用 LLM 生成脚本
        pass
    
    async def generate_audio(self, script: str, voice_id: str) -> str:
        # 调用 TTS 生成音频
        pass
```

**Step 3: Commit**

```bash
git add backend/app/services/
git commit -m "feat: add podcast generation services"
```

---

### Task 8: 生成 API

**Files:**

- Modify: `backend/app/api/v1/endpoints/episodes.py`

**Step 1: Add generate endpoints**

```python
@router.post("/{episode_id}/generate-script")
async def generate_script(episode_id: int, news_id: int, db: Session = Depends(get_db)):
    # 1. 获取 EpisodeNews
    # 2. 调用 LLM 生成脚本
    # 3. 更新状态
    return {"script": "generated..."}

@router.post("/{episode_id}/generate-audio")
async def generate_audio(episode_id: int, news_id: int, db: Session = Depends(get_db)):
    # 1. 获取脚本
    # 2. 调用 TTS
    # 3. 返回音频 URL
    return {"audio_url": "..."}
```

**Step 2: Commit**

```bash
git commit -m "feat: add generate script/audio API endpoints"
```

---

## 总结

| Task | 内容 |
|------|------|
| 1 | 项目结构初始化 |
| 2 | 数据库模型 |
| 3 | Pydantic Schemas |
| 4 | RSS Source API |
| 5 | News API |
| 6 | Episode API |
| 7 | 生成服务封装 |
| 8 | 生成 API |

---

**Plan complete and saved to `docs/plans/2026-02-26-backend-api.md`**

---

## 执行方式

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
