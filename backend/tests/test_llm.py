"""Tests for LLM Service"""
import pytest
import os
from app.services.llm import DeepSeekService


class TestDeepSeekService:
    """Test DeepSeek LLM service"""

    @pytest.fixture
    def llm_service(self):
        """Create LLM service instance"""
        return DeepSeekService()

    def test_api_key_loaded(self, llm_service):
        """Test that API key is loaded"""
        assert llm_service.api_key is not None
        assert llm_service.api_key.startswith("sk-")

    def test_simple_generation(self, llm_service):
        """Test simple text generation"""
        response = llm_service.generate(
            prompt="Say 'Hello World' in Chinese",
            max_tokens=50
        )
        
        assert response.text is not None
        assert len(response.text) > 0
        assert response.usage is not None
        assert "total_tokens" in response.usage

    def test_podcast_script_generation(self, llm_service):
        """Test podcast script generation"""
        from app.services.llm import PODCAST_USER_TEMPLATE
        
        news_content = """
新闻1：苹果发布新一代iPhone 16 Pro
摘要：苹果公司推出了iPhone 16 Pro，搭载全新A18 Pro芯片。
"""
        
        prompt = PODCAST_USER_TEMPLATE.format(news_text=news_content)
        
        response = llm_service.generate(
            prompt=prompt,
            max_tokens=500
        )
        
        # Check response
        assert response.text is not None
        assert len(response.text) > 100
        
        # Should contain dialogue markers (彪悍罗 or OK王)
        assert "彪" in response.text or "罗" in response.text
        
        print(f"\nGenerated script:\n{response.text[:300]}...")

    @pytest.mark.asyncio
    async def test_podcast_service_script_generation(self):
        """Test podcast service script generation"""
        from app.services.podcast import get_podcast_service
        
        podcast_service = get_podcast_service()
        
        news_content = "苹果发布iPhone 16 Pro，搭载A18 Pro芯片"
        
        script = await podcast_service.generate_script(
            news_content=news_content,
            max_tokens=300
        )
        
        assert script is not None
        assert len(script) > 0
        print(f"\nGenerated script: {script[:200]}...")
