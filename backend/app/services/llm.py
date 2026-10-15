"""MiniMax LLM 服务 - 使用 OpenAI SDK（MiniMax 提供 OpenAI 兼容接口）"""
import os
import logging
import yaml

from openai import OpenAI
from typing import Dict, Any, Optional
from pydantic import BaseModel

# Load .env file
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

# ===== Load prompts =====
PROMPTS_FILE = os.path.join(os.path.dirname(__file__), "prompts.yaml")


def _load_prompts() -> dict:
    """Load prompts from prompts.yaml"""
    try:
        with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        logger.warning(f"Prompts config file not found: {PROMPTS_FILE}")
        return {}


def _get_prompt(key: str, default: str = "") -> str:
    """Get prompt, fallback to default"""
    prompts = _load_prompts()
    return prompts.get(key, default)


# Load prompts from config
PROMPTS = _load_prompts()

LUO_SYSTEM_PROMPT = PROMPTS.get("luo_system_prompt", "")
ZIRU_SYSTEM_PROMPT = PROMPTS.get("ziru_system_prompt", "")
PODCAST_SYSTEM_PROMPT = PROMPTS.get("podcast_system_prompt", "")
PODCAST_USER_TEMPLATE = PROMPTS.get("podcast_user_template", """请根据以下科技新闻，生成一期脱口秀风格播客逐字稿正文部分。

新闻素材：
{news_text}

要求：
1. 直接开始讨论新闻，不需要开场白
2. 围绕每条新闻展开讨论，老罗犀利点评，自如专业分析
3. 每条新闻讨论2-3轮对话
4. 适当引用新闻中的关键信息
5. 最后有结束语

请直接输出对话内容正文。""")

# Fixed intro (not passed to LLM)
INTRO_TEXT = PROMPTS.get("intro_text", "")

# 候选标题 / 公众号图文 / 话题聚类提示词
TITLE_SUGGESTION_PROMPT = PROMPTS.get("title_suggestion_prompt", "")
ARTICLE_PROMPT = PROMPTS.get("article_prompt", "")
TOPIC_CLUSTER_PROMPT = PROMPTS.get("topic_cluster_prompt", "")


def get_intro() -> str:
    """Get fixed intro"""
    return INTRO_TEXT


def extract_json_array(text: str):
    """从 LLM 输出中提取 JSON 数组：先严格解析，失败则截取首个 [ 到末个 ] 再试一次"""
    import json

    if not text:
        return None
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except (json.JSONDecodeError, TypeError):
        return None


class LLMResponse(BaseModel):
    """LLM Response"""
    text: str
    usage: Optional[Dict[str, int]] = None


class MiniMaxLLMService:
    """MiniMax LLM API Service - using OpenAI SDK (OpenAI-compatible endpoint)"""

    BASE_URL = "https://api.minimaxi.com/v1"
    DEFAULT_MODEL = "abab6.5s-chat"

    def __init__(self, api_key: Optional[str] = None, model: str = None):
        self.api_key = api_key or os.getenv("MINIMAX_API_KEY")
        self.model = model or os.getenv("MINIMAX_MODEL") or self.DEFAULT_MODEL
        # 显式超时与有限重试：LLM 端点挂起时快速失败，避免拖垮整个后端事件循环
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.BASE_URL,
            timeout=60,
            max_retries=1,
        )

    async def agenerate(self, *args, **kwargs) -> LLMResponse:
        """异步包装：同步 SDK 调用放进线程池，不阻塞事件循环"""
        import asyncio
        return await asyncio.to_thread(self.generate, *args, **kwargs)

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7
    ) -> LLMResponse:
        """
        Call LLM to generate content

        Args:
            prompt: User prompt
            system_prompt: System prompt (persona)
            max_tokens: Max tokens
            temperature: Temperature (0-1)

        Returns:
            LLMResponse
        """
        try:
            messages = []

            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})

            messages.append({"role": "user", "content": prompt})

            logger.info(f"MiniMax LLM API request with model: {self.model}")

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )

            # Parse response
            text = response.choices[0].message.content

            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }

            logger.info(f"LLM generated {len(text)} chars, usage: {usage}")

            return LLMResponse(text=text, usage=usage)

        except Exception as e:
            logger.error(f"MiniMax LLM API error: {e}")
            raise
