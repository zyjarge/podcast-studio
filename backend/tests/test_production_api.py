"""
生产相关 API 测试（新版 UI 后端能力）

- episodes 新字段 notes/article/title_suggestions/cover_choice 的读写
- PUT status=published 时写入 published_at（重复发布不覆盖）
- generate-titles / generate-article 契约测试（mock LLM，
  只断言响应结构与落库行为，不断言真实 LLM 输出）
"""
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import Base, get_db
from app.db import models  # noqa: F401  确保所有表注册到 metadata
from app.db.models import News
from app.services import podcast as podcast_module


@pytest.fixture()
def client(tmp_path):
    """每个测试用独立的临时 sqlite，覆盖 get_db 依赖，不污染真实数据库"""
    engine = create_engine(
        f"sqlite:///{tmp_path}/test.db",
        connect_args={"check_same_thread": False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app), TestingSessionLocal
    app.dependency_overrides.pop(get_db, None)


def _create_episode(http, title="测试节目"):
    resp = http.post("/api/v1/episodes/", json={"title": title})
    assert resp.status_code == 200
    return resp.json()["id"]


def _create_news(SessionLocal, title, summary="", content="", keywords=None, score=0.0):
    db = SessionLocal()
    try:
        news = News(
            title=title,
            source="测试来源",
            url=f"http://test.com/{abs(hash(title))}",
            summary=summary,
            content=content,
            keywords=keywords or [],
            score=score,
        )
        db.add(news)
        db.commit()
        db.refresh(news)
        return news.id
    finally:
        db.close()


class TestEpisodeNewFields:
    """episodes 新字段读写"""

    def test_new_fields_roundtrip(self, client):
        http, _ = client
        ep_id = _create_episode(http)

        # 新字段默认为空字符串
        resp = http.get(f"/api/v1/episodes/{ep_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["notes"] == ""
        assert data["article"] == ""
        assert data["title_suggestions"] == ""
        assert data["cover_choice"] == ""

        # PUT 写入三个可编辑字段
        resp = http.put(f"/api/v1/episodes/{ep_id}", json={
            "notes": "本期聚焦 AI 行业动态",
            "article": "# 草稿正文",
            "cover_choice": json.dumps({"style": "flat", "index": 1}, ensure_ascii=False),
        })
        assert resp.status_code == 200

        # GET 回读校验
        data = http.get(f"/api/v1/episodes/{ep_id}").json()
        assert data["notes"] == "本期聚焦 AI 行业动态"
        assert data["article"] == "# 草稿正文"
        assert json.loads(data["cover_choice"]) == {"style": "flat", "index": 1}

    def test_title_suggestions_not_editable_via_put(self, client):
        """title_suggestions 由 generate-titles 端点写入，不开放 PUT 编辑"""
        http, _ = client
        ep_id = _create_episode(http)

        resp = http.put(f"/api/v1/episodes/{ep_id}", json={"title_suggestions": "x"})
        # extra="forbid" 在 schema 层直接拒绝未知字段
        assert resp.status_code == 422

    def test_publish_sets_published_at(self, client):
        http, _ = client
        ep_id = _create_episode(http)

        data = http.get(f"/api/v1/episodes/{ep_id}").json()
        assert data["published_at"] is None

        # 首次发布写入 published_at
        resp = http.put(f"/api/v1/episodes/{ep_id}", json={"status": "published"})
        assert resp.status_code == 200
        first = resp.json()["published_at"]
        assert first is not None

        # 重复发布不覆盖已有 published_at
        resp = http.put(f"/api/v1/episodes/{ep_id}", json={"status": "published"})
        assert resp.json()["published_at"] == first

        # 回退草稿后重新发布，published_at 应被重新写入
        http.put(f"/api/v1/episodes/{ep_id}", json={"status": "draft"})
        resp = http.put(f"/api/v1/episodes/{ep_id}", json={"status": "published"})
        assert resp.json()["published_at"] is not None


class TestGenerateTitles:
    """POST /episodes/{id}/generate-titles 契约测试"""

    FAKE_TITLES = [
        {"text": "大模型混战：谁在裸泳", "style": "观点型"},
        {"text": "一夜发布的 AI 新品，藏着什么信号", "style": "悬念型"},
        {"text": "本周 AI 圈三件大事", "style": "盘点型"},
    ]

    def _prepare_episode_with_news(self, client):
        http, SessionLocal = client
        ep_id = _create_episode(http)
        n1 = _create_news(SessionLocal, "AI 大模型发布", summary="某公司发布新模型")
        resp = http.post(f"/api/v1/episodes/{ep_id}/news", json=[n1])
        assert resp.status_code == 200
        return http, ep_id

    def test_generate_titles_contract(self, client, monkeypatch):
        http, ep_id = self._prepare_episode_with_news(client)

        async def fake_generate_titles(*args, **kwargs):
            return json.dumps(self.FAKE_TITLES, ensure_ascii=False)

        monkeypatch.setattr(
            podcast_module.podcast_service, "generate_titles", fake_generate_titles
        )

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-titles")
        assert resp.status_code == 200
        data = resp.json()
        assert "titles" in data
        assert len(data["titles"]) == 3
        for t in data["titles"]:
            assert set(t) == {"text", "style"}

        # 落库校验：title_suggestions 存的是 JSON 字符串
        ep = http.get(f"/api/v1/episodes/{ep_id}").json()
        assert json.loads(ep["title_suggestions"]) == self.FAKE_TITLES

    def test_generate_titles_lenient_parse(self, client, monkeypatch):
        """LLM 输出带额外文字时，宽松提取 [ ... ] 区间仍可解析"""
        http, ep_id = self._prepare_episode_with_news(client)

        async def fake_noisy(*args, **kwargs):
            return (
                "好的，以下是候选标题：\n"
                + json.dumps(self.FAKE_TITLES, ensure_ascii=False)
                + "\n希望对你有帮助"
            )

        monkeypatch.setattr(
            podcast_module.podcast_service, "generate_titles", fake_noisy
        )

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-titles")
        assert resp.status_code == 200
        assert len(resp.json()["titles"]) == 3

    def test_generate_titles_parse_failure_502(self, client, monkeypatch):
        http, ep_id = self._prepare_episode_with_news(client)

        async def fake_garbage(*args, **kwargs):
            return "抱歉，我无法生成标题"

        monkeypatch.setattr(
            podcast_module.podcast_service, "generate_titles", fake_garbage
        )

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-titles")
        assert resp.status_code == 502

    def test_generate_titles_llm_unavailable_502(self, client, monkeypatch):
        http, ep_id = self._prepare_episode_with_news(client)

        async def fake_raise(*args, **kwargs):
            raise RuntimeError("LLM service not initialized")

        monkeypatch.setattr(
            podcast_module.podcast_service, "generate_titles", fake_raise
        )

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-titles")
        assert resp.status_code == 502

    def test_generate_titles_empty_episode_400(self, client):
        http, _ = client
        ep_id = _create_episode(http)

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-titles")
        assert resp.status_code == 400

    def test_generate_titles_episode_not_found(self, client):
        http, _ = client
        resp = http.post("/api/v1/episodes/99999/generate-titles")
        assert resp.status_code == 404


class TestGenerateArticle:
    """POST /episodes/{id}/generate-article 契约测试"""

    ARTICLE = (
        "# AI 行业的一周\n\n导语：本周大事不断。\n\n"
        "### 大模型混战\n\n> 金句：快鱼吃慢鱼。\n\n正文段落。\n\n"
        "—— 科技双响炮编辑部"
    )

    def test_generate_article_contract(self, client, monkeypatch):
        http, SessionLocal = client
        ep_id = _create_episode(http)
        n1 = _create_news(
            SessionLocal, "AI 大模型发布", summary="摘要内容", content="正文内容"
        )
        http.post(f"/api/v1/episodes/{ep_id}/news", json=[n1])
        http.put(f"/api/v1/episodes/{ep_id}", json={"notes": "侧重商业影响"})

        captured = {}

        async def fake_generate_article(news_items, episode_notes="", **kwargs):
            captured["news_items"] = news_items
            captured["episode_notes"] = episode_notes
            return self.ARTICLE

        monkeypatch.setattr(
            podcast_module.podcast_service, "generate_article", fake_generate_article
        )

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-article")
        assert resp.status_code == 200
        data = resp.json()
        assert data["article"] == self.ARTICLE
        assert data["char_count"] == len(self.ARTICLE)

        # episode.notes 作为 episode_notes 传入，新闻带齐四个字段
        assert captured["episode_notes"] == "侧重商业影响"
        item = captured["news_items"][0]
        assert item["title"] == "AI 大模型发布"
        assert item["summary"] == "摘要内容"
        assert item["content"] == "正文内容"
        assert item["notes"] == ""

        # 落库校验
        ep = http.get(f"/api/v1/episodes/{ep_id}").json()
        assert ep["article"] == self.ARTICLE

    def test_generate_article_excludes_deleted_news(self, client, monkeypatch):
        """软删除（回收站）的新闻不参与图文生成"""
        http, SessionLocal = client
        ep_id = _create_episode(http)
        n1 = _create_news(SessionLocal, "保留的新闻", summary="保留")
        n2 = _create_news(SessionLocal, "已删除的新闻", summary="删除")
        http.post(f"/api/v1/episodes/{ep_id}/news", json=[n1, n2])
        http.post(f"/api/v1/episodes/{ep_id}/news/{n2}/soft-delete")

        captured = {}

        async def fake_generate_article(news_items, episode_notes="", **kwargs):
            captured["news_items"] = news_items
            return self.ARTICLE

        monkeypatch.setattr(
            podcast_module.podcast_service, "generate_article", fake_generate_article
        )

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-article")
        assert resp.status_code == 200
        assert [i["title"] for i in captured["news_items"]] == ["保留的新闻"]

    def test_generate_article_llm_unavailable_502(self, client, monkeypatch):
        http, SessionLocal = client
        ep_id = _create_episode(http)
        n1 = _create_news(SessionLocal, "AI 大模型发布")
        http.post(f"/api/v1/episodes/{ep_id}/news", json=[n1])

        async def fake_raise(*args, **kwargs):
            raise RuntimeError("LLM service not initialized")

        monkeypatch.setattr(
            podcast_module.podcast_service, "generate_article", fake_raise
        )

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-article")
        assert resp.status_code == 502

    def test_generate_article_empty_episode_400(self, client):
        http, _ = client
        ep_id = _create_episode(http)

        resp = http.post(f"/api/v1/episodes/{ep_id}/generate-article")
        assert resp.status_code == 400


class TestFetchNewsResults:
    """抓取结果必须如实上报（回归：曾经单源失败也提示成功）"""

    def _create_source(self, SessionLocal, name="测试源", url="http://rss.test/feed"):
        from app.db.models import RSSSource
        db = SessionLocal()
        try:
            src = RSSSource(name=name, url=url, enabled=True)
            db.add(src)
            db.commit()
            db.refresh(src)
            return src.id
        finally:
            db.close()

    def test_failed_source_reported(self, client, monkeypatch):
        http, SessionLocal = client
        src_id = self._create_source(SessionLocal)

        async def boom(self, url, limit=20):
            raise ConnectionError("连接被拒绝")

        from app.services.rss import RSSService
        monkeypatch.setattr(RSSService, "fetch", boom)

        resp = http.post("/api/v1/news/fetch", params={"source_id": src_id})
        assert resp.status_code == 200
        data = resp.json()
        assert data["added"] == 0
        assert data["failed_sources"] == ["测试源"]
        r = data["results"][0]
        assert r["ok"] is False
        assert r["error"]

    def test_success_source_counts_new_items(self, client, monkeypatch):
        http, SessionLocal = client
        src_id = self._create_source(SessionLocal, name="好源")

        from types import SimpleNamespace
        items = [
            SimpleNamespace(title="新闻A", url="http://test.com/a1", summary="摘要", content="正文"),
            SimpleNamespace(title="新闻B", url="http://test.com/b1", summary="摘要", content="正文"),
        ]

        async def fake_fetch(self, url, limit=20):
            return items

        from app.services.rss import RSSService
        monkeypatch.setattr(RSSService, "fetch", fake_fetch)

        resp = http.post("/api/v1/news/fetch", params={"source_id": src_id})
        assert resp.status_code == 200
        data = resp.json()
        assert data["added"] == 2
        assert data["failed_sources"] == []
        assert data["results"][0]["ok"] is True
        assert data["results"][0]["added"] == 2

        # 再抓一次：URL 去重，新增为 0
        resp2 = http.post("/api/v1/news/fetch", params={"source_id": src_id})
        assert resp2.json()["added"] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
