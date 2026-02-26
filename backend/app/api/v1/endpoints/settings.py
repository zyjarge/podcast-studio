from fastapi import APIRouter, HTTPException
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# .env 文件路径
ENV_FILE = Path(__file__).parent.parent.parent / ".env"


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
