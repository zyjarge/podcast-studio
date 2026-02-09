"""DeepSeek LLM 服务 - 使用 OpenAI SDK"""
from openai import OpenAI
from typing import Dict, Any, Optional
from pydantic import BaseModel
import os
import logging
import yaml

# 加载 .env 文件
from dotenv import load_dotenv
load_dotenv()

# ===== 提示词加载 =====
PROMPTS_FILE = os.path.join(os.path.dirname(__file__), "..", "prompts.yaml")


def _load_prompts() -> dict:
    """从 prompts.yaml 加载提示词"""
    try:
        with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        logger.warning(f"提示词配置文件不存在: {PROMPTS_FILE}")
        return {}


def _get_prompt(key: str, default: str = "") -> str:
    """获取提示词，支持回退到默认值"""
    prompts = _load_prompts()
    return prompts.get(key, default)


# 从配置文件加载提示词
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

# 固定开场白（不传给 LLM）
INTRO_TEXT = PROMPTS.get("intro_text", "")


def get_intro() -> str:
    """获取固定开场白"""
    return INTRO_TEXT

logger = logging.getLogger(__name__)


class LLMResponse(BaseModel):
    """LLM 响应"""
    text: str
    usage: Optional[Dict[str, int]] = None


class DeepSeekService:
    """DeepSeek API 服务 - 使用 OpenAI SDK"""

    BASE_URL = "https://api.deepseek.com"
    DEFAULT_MODEL = "deepseek-chat"

    def __init__(self, api_key: Optional[str] = None, model: str = None):
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        self.model = model or self.DEFAULT_MODEL
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=self.BASE_URL
        )

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 4096,
        temperature: float = 0.7
    ) -> LLMResponse:
        """
        调用 LLM 生成内容

        Args:
            prompt: 用户提示词
            system_prompt: 系统提示词（人设）
            max_tokens: 最大 token 数
            temperature: 温度（0-1）

        Returns:
            LLMResponse
        """
        try:
            messages = []

            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})

            messages.append({"role": "user", "content": prompt})

            logger.info(f"DeepSeek API request with model: {self.model}")

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )

            # 解析响应
            text = response.choices[0].message.content

            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }

            logger.info(f"LLM generated {len(text)} chars, usage: {usage}")

            return LLMResponse(text=text, usage=usage)

        except Exception as e:
            logger.error(f"DeepSeek API error: {e}")
            raise




def generate_podcast_script(
    news_items: list,
    llm: Optional[DeepSeekService] = None
) -> str:
    """
    生成播客逐字稿

    Args:
        news_items: 新闻列表 [{title, url, summary, ...}]
        llm: LLM 服务实例

    Returns:
        逐字稿文本
    """
    if llm is None:
        llm = DeepSeekService()

    # 构建新闻内容
    news_content = []
    for i, item in enumerate(news_items, 1):
        news_content.append(f"""
新闻{i}：{item.get('title', '') if isinstance(item, dict) else item.title}
URL: {item.get('url', '') if isinstance(item, dict) else item.url}
摘要: {item.get('summary', '') if isinstance(item, dict) else (item.summary if hasattr(item, 'summary') else '')}
""")

    news_text = "\n".join(news_content)

    # 使用模板生成提示词
    prompt = PODCAST_USER_TEMPLATE.format(news_text=news_text)

    response = llm.generate(
        prompt=prompt,
        system_prompt=PODCAST_SYSTEM_PROMPT,
        max_tokens=8192,
        temperature=0.8
    )

    return response.text


def main():
    """测试函数"""
    from app.services.rss import RSSService
    import asyncio

    print("正在获取新闻...")
    rss_service = RSSService()
    news = asyncio.run(rss_service.fetch(
        feed_url="https://kejikuaixun.blogspot.com/feeds/posts/default?alt=rss",
        limit=20
    ))

    print(f"获取到 {len(news)} 条新闻")

    print("\n正在生成播客逐字稿...")
    body = generate_podcast_script(news)

    # 添加固定开场白
    intro = get_intro()
    script = f"{intro}\n\n{body}"

    print(f"\n生成的逐字稿 ({len(script)} 字):\n")
    print("=" * 60)
    print(script[:3000])
    print("..." if len(script) > 3000 else "")
    print("=" * 60)

    # 保存到文件
    with open("data/scripts/podcast_script.txt", "w", encoding="utf-8") as f:
        f.write(script)
    print(f"\n逐字稿已保存到: data/scripts/podcast_script.txt")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
