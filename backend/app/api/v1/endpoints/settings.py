from fastapi import APIRouter, HTTPException
from app.core.config import settings
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
async def get_api_status():
    """获取 API 配置状态"""
    status = {}
    
    # Test DeepSeek
    if settings.DEEPSEEK_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url="https://api.deepseek.com"
            )
            # Simple test - just check if key format is valid
            if settings.DEEPSEEK_API_KEY.startswith("sk-"):
                status["deepseek"] = {"connected": True, "status": "ok"}
            else:
                status["deepseek"] = {"connected": False, "status": "invalid_key_format"}
        except Exception as e:
            status["deepseek"] = {"connected": False, "status": str(e)}
    else:
        status["deepseek"] = {"connected": False, "status": "not_configured"}
    
    # Test MiniMax
    if settings.MINIMAX_API_KEY:
        try:
            import requests
            headers = {"Authorization": f"Bearer {settings.MINIMAX_API_KEY}"}
            # Test with a simple API call
            resp = requests.get(
                "https://api.minimaxi.com/v1/user/info",
                headers=headers,
                timeout=5
            )
            if resp.status_code == 200:
                status["minimax"] = {"connected": True, "status": "ok"}
            else:
                status["minimax"] = {"connected": False, "status": f"error_{resp.status_code}"}
        except Exception as e:
            status["minimax"] = {"connected": False, "status": str(e)}
    else:
        status["minimax"] = {"connected": False, "status": "not_configured"}
    
    return status
