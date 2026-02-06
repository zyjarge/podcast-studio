"""NewsNow 新闻获取服务"""
import httpx
from typing import List, Dict, Optional
from pydantic import BaseModel
import logging

# 加载 .env 文件
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)


class NewsItem(BaseModel):
    """单条新闻数据结构"""
    title: str
    url: str
    source: str = "wallstreetcn"
    published_at: Optional[str] = None


class NewsNowService:
    """NewsNow API 新闻获取服务"""

    BASE_URL = "https://newsnow.busiyi.world/api/s"

    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.client = httpx.AsyncClient(
            timeout=timeout,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            }
        )

    async def fetch_news(
        self,
        source_id: str = "wallstreetcn-news",
        limit: int = 30,
        exclude_member: bool = True
    ) -> List[NewsItem]:
        """
        从 NewsNow 获取新闻列表

        Args:
            source_id: 新闻源 ID (如 wallstreetcn-news)
            limit: 获取数量上限
            exclude_member: 是否排除付费内容 (默认 True)

        Returns:
            NewsItem 列表
        """
        try:
            params = {"id": source_id}
            logger.info(f"Fetching news from: {self.BASE_URL}?{source_id}")

            response = await self.client.get(self.BASE_URL, params=params)
            response.raise_for_status()

            data = response.json()
            logger.debug(f"API response: {data}")

            news_list = self._parse_response(data)

            # 剔除付费内容
            if exclude_member:
                news_list = self._filter_member_content(news_list)

            logger.info(f"Parsed {len(news_list)} news items")

            return news_list[:limit]

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error: {e.response.status_code}")
            raise
        except Exception as e:
            logger.error(f"Error fetching news: {e}")
            raise

    def _filter_member_content(self, news_list: List[NewsItem]) -> List[NewsItem]:
        """剔除付费内容 (/member/)"""
        filtered = [
            item for item in news_list
            if "/member/" not in item.url
        ]
        removed_count = len(news_list) - len(filtered)
        if removed_count > 0:
            logger.info(f"Filtered out {removed_count} member-only articles")
        return filtered

    def _parse_response(self, data: dict) -> List[NewsItem]:
        """解析 API 返回数据"""
        items = data.get("items", data.get("data", []))

        if not items:
            logger.warning("No data found in API response")
            return []

        news_list = []
        for item in items:
            # 解析不同格式
            title = item.get("title", "")
            url = item.get("url", "")
            # extra.date 是毫秒时间戳
            extra = item.get("extra", {})
            if isinstance(extra, dict) and extra.get("date"):
                import datetime
                timestamp_ms = extra["date"]
                published_at = datetime.datetime.fromtimestamp(
                    timestamp_ms / 1000
                ).isoformat()
            else:
                published_at = None

            if title and url:
                news_list.append(NewsItem(
                    title=title,
                    url=url,
                    source="wallstreetcn",
                    published_at=published_at
                ))

        return news_list

    async def close(self):
        """关闭 HTTP 客户端"""
        await self.client.aclose()


async def main():
    """测试函数"""
    import json

    service = NewsNowService()
    try:
        news = await service.fetch_news(limit=10)

        print(f"\n获取到 {len(news)} 条新闻:\n")
        for i, item in enumerate(news, 1):
            print(f"{i}. {item.title}")
            print(f"   URL: {item.url}\n")

    finally:
        await service.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
