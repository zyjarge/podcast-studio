"""
新闻抓取单元测试
"""
import pytest
import asyncio
from datetime import datetime
from app.services.rss import RSSService
from app.services.news_scorer import NewsScorer
from app.db.session import SessionLocal
from app.db.models import News, RSSSource


class TestRSSService:
    """RSS 服务测试"""
    
    @pytest.mark.asyncio
    async def test_fetch_jin10_rss(self):
        """测试抓取金十数据 RSS"""
        rss = RSSService()
        
        items = await rss.fetch('http://192.168.3.20:1200/telegram/channel/jin10data', limit=5)
        
        assert len(items) > 0, "应该能获取到新闻"
        
        # 检查 item 结构
        for item in items:
            assert hasattr(item, 'title'), "新闻应该有 title"
            assert hasattr(item, 'url'), "新闻应该有 url"
            assert hasattr(item, 'summary'), "新闻应该有 summary"
            assert item.title, "标题不应该为空"
            assert item.url, "URL 不应该为空"
            
        print(f"✓ 抓取到 {len(items)} 条新闻")
        print(f"  第一条: {items[0].title[:30]}...")
        
    @pytest.mark.asyncio
    async def test_fetch_ai_rss(self):
        """测试抓取 AI 探索指南 RSS"""
        rss = RSSService()
        
        items = await rss.fetch('http://192.168.3.20:1200/telegram/channel/aigc1024', limit=5)
        
        assert len(items) > 0, "应该能获取到 AI 新闻"
        
        print(f"✓ AI 新闻抓取到 {len(items)} 条")
        
    def test_clean_summary(self):
        """测试摘要清理"""
        rss = RSSService()
        
        # 测试 HTML 标签清理
        summary = "<p>这是测试内容</p><br>包含 HTML 标签"
        cleaned = rss._clean_summary(summary)
        
        assert "<p>" not in cleaned, "应该移除 HTML 标签"
        assert "这是测试内容" in cleaned, "应该保留正文"
        
        print("✓ 摘要清理功能正常")


class TestNewsScorer:
    """新闻评分测试"""
    
    def test_score_news(self):
        """测试新闻评分"""
        db = SessionLocal()
        scorer = NewsScorer(db)
        
        # 创建测试新闻
        news = News(
            title="测试新闻标题",
            source="测试来源",
            url="http://test.com",
            summary="这是一个测试摘要" * 10,
            content="这是测试内容" * 20,
            rss_source_id=1
        )
        
        scores = scorer.score_news(news)
        
        assert "score" in scores, "应该返回总分"
        assert "score_authority" in scores, "应该返回权威性评分"
        assert "score_timeliness" in scores, "应该返回时效性评分"
        assert "score_depth" in scores, "应该返回深度评分"
        
        assert scores["score"] >= 0, "评分应该 >= 0"
        assert scores["score"] <= 100, "评分应该 <= 100"
        
        print(f"✓ 新闻评分: {scores['score']}")
        print(f"  权威性: {scores['score_authority']}")
        print(f"  时效性: {scores['score_timeliness']}")
        print(f"  内容深度: {scores['score_depth']}")
        
        db.close()
    
    def test_score_all_news(self):
        """测试批量评分"""
        db = SessionLocal()
        scorer = NewsScorer(db)
        
        # 统计新闻数量
        total = db.query(News).count()
        print(f"数据库中共有 {total} 条新闻")
        
        # 评分前无评分的数量
        no_score = db.query(News).filter(
            (News.score == None) | (News.score == 0)
        ).count()
        print(f"需要评分的新闻: {no_score}")
        
        db.close()


class TestNewsAPI:
    """新闻 API 集成测试"""
    
    def test_fetch_and_save_news(self):
        """测试抓取并保存新闻"""
        from app.api.v1.endpoints.news import fetch_news
        from fastapi.testclient import TestClient
        from app.main import app
        
        client = TestClient(app)
        
        # 抓取新闻
        response = client.post("/api/v1/news/fetch?source_id=3")
        
        assert response.status_code == 200, f"API 应该返回 200, 实际: {response.status_code}"
        
        data = response.json()
        assert "message" in data, "响应应该包含 message"
        
        print(f"✓ API 响应: {data['message']}")
    
    def test_list_news(self):
        """测试获取新闻列表"""
        from fastapi.testclient import TestClient
        from app.main import app
        
        client = TestClient(app)
        
        response = client.get("/api/v1/news?limit=10")
        
        assert response.status_code == 200
        
        news_list = response.json()
        assert isinstance(news_list, list), "应该返回新闻列表"
        
        print(f"✓ 获取到 {len(news_list)} 条新闻")
        
        if news_list:
            print(f"  最新: {news_list[0]['title'][:30]}...")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
