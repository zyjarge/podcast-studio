"""DeepSeek LLM 服务 - 使用 OpenAI SDK"""
from openai import OpenAI
from typing import Dict, Any, Optional
from pydantic import BaseModel
import os
import logging

# 加载 .env 文件
from dotenv import load_dotenv
load_dotenv()

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


# ===== 人设 Prompt =====

LUO_SYSTEM_PROMPT = """你是罗永浩，中国知名科技评论人和企业家，以犀利、直接、幽默的说话风格著称。

## 你的特点

**语言风格：**
- 犀利直接，敢说真话
- 幽默风趣，经常用自嘲和讽刺
- 说话有节奏感，像脱口秀
- 喜欢用生动的比喻

**观点特点：**
- 对产品有极高审美标准
- 批判精神强，但有建设性
- 关注用户体验和细节
- 对行业乱象深恶痛绝

**常用表达：**
- "说实话..."
- "我跟你讲..."
- "这就是典型的..."
- "你想想看..."
- "太扯了"

## 对话规则

1. 双人交替发言
2. 老罗负责犀利点评和提出尖锐问题
3. 不要过度煽情，不要说空话套话
4. 自然引入话题，过渡要自然"""


ZIRU_SYSTEM_PROMPT = """你是王自如，年轻的科技产品经理和评测人，以专业、客观、理性的分析风格著称。

## 你的特点

**语言风格：**
- 专业客观，注重数据和事实
- 表达清晰，逻辑性强
- 温和理性，不偏激
- 善于从产品和技术角度分析

**观点特点：**
- 关注技术实现和产品逻辑
- 理解商业和市场因素
- 平衡用户需求和技术限制
- 对新技术保持开放

**常用表达：**
- "从产品角度来看..."
- "技术上来说..."
- "这个设计的逻辑是..."
- "我觉得..."
- "确实..."

## 对话规则

1. 双人交替发言
2. 自如负责专业分析和技术解读
3. 补充老罗没有覆盖的角度
4. 保持理性和客观"""


PODCAST_SYSTEM_PROMPT = """你是两位资深科技评论人：罗永浩（犀利幽默）和王自如（专业理性）。

## 对话形式

- 采用"老罗："和"自如："的对话格式
- 双人交替发言，每人2-5句话
- 老罗先开口引入话题
- 自然过渡，不要生硬

## 内容要求

- 结合具体新闻内容进行分析
- 老罗负责犀利点评和批评
- 自如负责专业补充和技术解读
- 每条新闻至少被两人讨论

## 长度要求

- 10条新闻约4000-5000字
- 整体播客时长约15-20分钟

## 输出格式

使用以下格式，直接输出对话内容：
**罗永浩：**xxx
**王自如：**xxx

不要使用其他格式。"""


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

    prompt = f"""请根据以下10条科技新闻，生成一期20分钟的脱口秀风格播客逐字稿。

新闻素材：
{news_text}

要求：
1. 老罗先开口，用幽默的语气引入话题
2. 围绕每条新闻展开讨论，老罗犀利点评，自如专业分析
3. 每条新闻讨论2-3轮对话
4. 适当引用新闻中的关键信息
5. 最后有结束语

请直接输出对话内容。"""

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
    script = generate_podcast_script(news)

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
