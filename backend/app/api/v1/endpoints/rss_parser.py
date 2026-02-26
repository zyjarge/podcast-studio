from fastapi import APIRouter, HTTPException
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/parse-rss")
async def parse_rss_title(url: str):
    """从 RSS URL 解析标题"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            text = response.text
            
            # 解析 <title> 标签 (支持 CDATA)
            import re
            patterns = [
                r'<title><!\[CDATA\[([^\]]+)\]\]></title>',
                r'<title>([^<]+)</title>',
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    # 返回第一个 title (通常是 channel title)
                    title = matches[0].strip()
                    # 清理标题
                    title = title.replace(' - RSS', '').replace(' | RSS', '').strip()
                    return {"title": title}
            
            raise HTTPException(status_code=400, detail="无法解析标题")
            
    except httpx.RequestError as e:
        logger.error(f"Failed to fetch RSS: {e}")
        raise HTTPException(status_code=400, detail=f"无法访问该 URL: {str(e)}")
