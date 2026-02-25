"""RSS 新闻获取服务"""
import httpx
from typing import List, Optional
from pydantic import BaseModel
from dataclasses import dataclass
import logging
import xml.etree.ElementTree as ET

# 加载 .env 文件
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)


@dataclass
class RSSItem:
    """单条 RSS 新闻"""
    title: str
    url: str
    summary: str
    published_at: Optional[str] = None


class RSSService:
    """RSS  feeds 获取服务"""

    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def fetch(
        self,
        feed_url: str,
        limit: int = 20
    ) -> List[RSSItem]:
        """
        获取 RSS feeds

        Args:
            feed_url: RSS 地址
            limit: 返回数量限制

        Returns:
            RSSItem 列表
        """
        try:
            logger.info(f"Fetching RSS: {feed_url}")

            response = await self.client.get(feed_url)
            response.raise_for_status()

            items = self._parse_rss(response.text)
            logger.info(f"Parsed {len(items)} items from RSS")

            return items[:limit]

        except Exception as e:
            logger.error(f"Error fetching RSS: {e}")
            raise

    def _parse_rss(self, xml_content: str) -> List[RSSItem]:
        """解析 RSS XML 内容"""
        items = []

        try:
            root = ET.fromstring(xml_content)
            channel = root.find("channel")

            if channel is None:
                logger.warning("No channel found in RSS")
                return []

            for item in channel.findall("item"):
                title_el = item.find("title")
                url_el = item.find("link")
                summary_el = item.find("description")
                pubdate_el = item.find("pubDate")

                title = title_el.text.strip() if title_el is not None and title_el.text else ""
                url = url_el.text.strip() if url_el is not None and url_el.text else ""
                summary = summary_el.text.strip() if summary_el is not None and summary_el.text else ""
                published_at = pubdate_el.text.strip() if pubdate_el is not None and pubdate_el.text else None

                if title and url:
                    items.append(RSSItem(
                        title=title,
                        url=url,
                        summary=self._clean_summary(summary),
                        published_at=published_at
                    ))

        except ET.ParseError as e:
            logger.error(f"XML parse error: {e}")

        return items

    def _clean_summary(self, summary: str) -> str:
        """清理摘要文本（去除 HTML 标签）"""
        import re
        # 移除 HTML 标签
        text = re.sub(r'<[^>]+>', '', summary)
        # 移除多余空白
        text = re.sub(r'\s+', ' ', text).strip()
        # 截取前 200 字
        if len(text) > 200:
            text = text[:200] + "..."
        return text

    async def close(self):
        await self.client.aclose()

    def fetch_sync(self, feed_url: str, limit: int = 20) -> List[RSSItem]:
        """同步获取 RSS（方便流水线使用）"""
        import httpx
        with httpx.Client(timeout=self.timeout) as client:
            response = client.get(feed_url)
            response.raise_for_status()
            return self._parse_rss(response.text)[:limit]


async def main():
    """测试函数"""
    service = RSSService()

    try:
        # 科技快讯 RSS
        feed_url = "https://kejikuaixun.blogspot.com/feeds/posts/default?alt=rss"

        items = await service.fetch(feed_url)

        print(f"\n获取到 {len(items)} 条新闻:\n")
        for i, item in enumerate(items, 1):
            print(f"{i}. {item.title}")
            print(f"   URL: {item.url}")
            print(f"   摘要: {item.summary}")
            print()

    finally:
        await service.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
