from fastapi import APIRouter, HTTPException
from app.core.config import settings
import httpx
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

router = APIRouter()

# .env 文件路径
ENV_FILE = Path(__file__).parent.parent.parent / ".env"


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
            if settings.DEEPSEEK_API_KEY.startswith("sk-"):
                status["deepseek"] = {"connected": True, "status": "ok"}
            else:
                status["deepseek"] = {"connected": False, "status": "invalid_key_format"}
        except Exception as e:
            status["deepseek"] = {"connected": False, "status": str(e)}
    else:
        status["deepseek"] = {"connected": False, "status": "not_configured"}
    
    # Test MiniMax - just check key format (API endpoint varies)
    if settings.MINIMAX_API_KEY:
        # MiniMax keys typically start with "sk-" or similar
        if settings.MINIMAX_API_KEY.startswith("sk-") or settings.MINIMAX_API_KEY.startswith("sk_"):
            status["minimax"] = {"connected": True, "status": "ok"}
        else:
            status["minimax"] = {"connected": False, "status": "invalid_key_format"}
    else:
        status["minimax"] = {"connected": False, "status": "not_configured"}
    
    return status


@router.get("/env-keys")
async def get_env_keys():
    """获取当前环境变量（已配置的 key）"""
    result = {}
    valid_keys = ["DEEPSEEK_API_KEY", "MINIMAX_API_KEY", "ELEVENLABS_API_KEY"]
    
    if ENV_FILE.exists():
        with open(ENV_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line and "=" in line:
                    key, value = line.split("=", 1)
                    if key in valid_keys and value:
                        # 返回掩码后的值
                        if len(value) > 8:
                            result[key] = value[:4] + "***" + value[-4:]
                        else:
                            result[key] = "***"
    
    return result


@router.post("/update-env")
async def update_env(key: str, value: str):
    """更新环境变量"""
    valid_keys = ["DEEPSEEK_API_KEY", "MINIMAX_API_KEY", "ELEVENLABS_API_KEY"]
    
    if key not in valid_keys:
        raise HTTPException(status_code=400, detail=f"无效的 key: {key}")
    
    try:
        # 读取现有 .env 文件
        env_lines = []
        if ENV_FILE.exists():
            with open(ENV_FILE, "r") as f:
                env_lines = f.readlines()
        
        # 查找并更新或添加
        key_found = False
        new_lines = []
        for line in env_lines:
            if line.strip().startswith(f"{key}="):
                new_lines.append(f"{key}={value}\n")
                key_found = True
            else:
                new_lines.append(line)
        
        if not key_found:
            new_lines.append(f"{key}={value}\n")
        
        # 写回文件
        with open(ENV_FILE, "w") as f:
            f.writelines(new_lines)
        
        # 更新当前进程的环境变量
        os.environ[key] = value
        
        logger.info(f"Updated {key} in .env file")
        
        return {"message": f"已更新 {key}", "key": key}
        
    except Exception as e:
        logger.error(f"Failed to update .env: {e}")
        raise HTTPException(status_code=500, detail=str(e))
