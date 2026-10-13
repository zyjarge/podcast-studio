from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import settings
import httpx
import logging
import os
import tempfile
from pathlib import Path
from threading import Lock

logger = logging.getLogger(__name__)

router = APIRouter()

# .env 文件路径
ENV_FILE = Path(__file__).parent.parent.parent / ".env"

# Serialise concurrent writers of .env. update_env and update_script_prompt
# both mutate the same file; without this lock two requests can clobber each
# other and the lockfile-less rename race writes could end up with mixed
# content.
_env_write_lock = Lock()

# 提示词配置的 key
SCRIPT_PROMPT_KEY = "SCRIPT_PROMPT"


def _atomic_replace_env(target: Path, lines: list) -> None:
    """Atomically replace the contents of `target` with `lines`.

    POSIX rename(2) replaces one inode atomically. We write to a
    NamedTemporaryFile in the same directory (so it lands on the same
    filesystem), fsync it, then os.replace onto the final path. A crash
    at any point leaves the previous .env intact instead of corrupting
    it. Sequential callers are serialised by the caller's lock.
    """
    target = Path(target)
    payload = "".join(lines).encode("utf-8")
    # delete=False so we control the rename; dir= same filesystem.
    fd, tmp_path = tempfile.mkstemp(
        prefix=target.name + ".", suffix=".tmp", dir=str(target.parent)
    )
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, target)
    except Exception:
        # Cleanup partial temp file; original .env untouched.
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


class ScriptPromptResponse(BaseModel):
    script_prompt: str


class ScriptPromptUpdate(BaseModel):
    script_prompt: str


@router.get("/status")
async def get_api_status():
    """获取 API 配置状态"""
    status = {}
    
    # Test DeepSeek - call API to verify connection
    if settings.DEEPSEEK_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url="https://api.deepseek.com"
            )
            # 发送简单提示词测试连接
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": "Hi"}],
                max_tokens=10
            )
            if response.choices and len(response.choices) > 0:
                status["deepseek"] = {"connected": True, "status": "ok"}
            else:
                status["deepseek"] = {"connected": False, "status": "empty_response"}
        except Exception as e:
            status["deepseek"] = {"connected": False, "status": str(e)}
    else:
        status["deepseek"] = {"connected": False, "status": "not_configured"}
    
    # Test MiniMax - call API to verify connection
    if settings.MINIMAX_API_KEY:
        try:
            import requests
            headers = {"Authorization": f"Bearer {settings.MINIMAX_API_KEY}"}
            # 使用文件列表接口测试，需要 purpose 参数
            resp = requests.get(
                "https://api.minimaxi.com/v1/files/list",
                headers=headers,
                params={"purpose": "t2a_async_input"},
                timeout=10
            )
            # 只要返回 200 就是连接正常
            if resp.status_code == 200:
                status["minimax"] = {"connected": True, "status": "ok"}
            else:
                status["minimax"] = {"connected": False, "status": f"error_{resp.status_code}"}
        except Exception as e:
            status["minimax"] = {"connected": False, "status": str(e)}
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
    """更新环境变量（写入 backend/app/api/.env + 立即更新进程内存，无需重启）"""
    valid_keys = ["DEEPSEEK_API_KEY", "MINIMAX_API_KEY", "MINIMAX_CN_API_KEY",
                  "ELEVENLABS_API_KEY", "TTS_MODEL", "TTS_SPEED", "TTS_VOL", "TTS_PITCH"]

    if key not in valid_keys:
        raise HTTPException(status_code=400, detail=f"无效的 key: {key}")

    try:
        # 1) Read-modify-write under lock so two requests can't tear each other.
        with _env_write_lock:
            env_lines: list = []
            if ENV_FILE.exists():
                with open(ENV_FILE, "r") as f:
                    env_lines = f.readlines()

            # 2) Replace the key's line in-place; append if it's new.
            key_found = False
            new_lines: list = []
            for line in env_lines:
                if line.strip().startswith(f"{key}="):
                    new_lines.append(f"{key}={value}\n")
                    key_found = True
                else:
                    new_lines.append(line)

            if not key_found:
                new_lines.append(f"{key}={value}\n")

            # 3) Atomic write — see _atomic_replace_env docstring.
            _atomic_replace_env(ENV_FILE, new_lines)

        # 4) Update the process env even if the file write above raised;
        # in-memory state survives a failed disk write but not the inverse.
        os.environ[key] = value

        logger.info(f"Updated {key} in {ENV_FILE} and os.environ")

        return {
            "message": f"已更新 {key}（立即生效，无需重启）",
            "key": key,
            "value_preview": (value[:8] + "...") if value else "",
            "saved_to": str(ENV_FILE),
            "in_process_env": bool(os.environ.get(key)),
        }

    except Exception as e:
        logger.error(f"Failed to update .env: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/script-prompt")
async def get_script_prompt():
    """获取提示词配置"""
    prompt = ""
    
    if ENV_FILE.exists():
        with open(ENV_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line and "=" in line:
                    key, value = line.split("=", 1)
                    if key == SCRIPT_PROMPT_KEY:
                        prompt = value
                        break
    
    return {"script_prompt": prompt}


@router.put("/script-prompt")
async def update_script_prompt(data: ScriptPromptUpdate):
    """更新提示词配置"""
    try:
        # Issue #6: same non-atomic-write bug as update_env. Use the
        # shared helper so a crash mid-write cannot corrupt .env.
        with _env_write_lock:
            env_lines: list = []
            if ENV_FILE.exists():
                with open(ENV_FILE, "r") as f:
                    env_lines = f.readlines()

            key_found = False
            new_lines: list = []
            for line in env_lines:
                if line.strip().startswith(f"{SCRIPT_PROMPT_KEY}="):
                    new_lines.append(f"{SCRIPT_PROMPT_KEY}={data.script_prompt}\n")
                    key_found = True
                else:
                    new_lines.append(line)

            if not key_found:
                new_lines.append(f"{SCRIPT_PROMPT_KEY}={data.script_prompt}\n")

            _atomic_replace_env(ENV_FILE, new_lines)

        logger.info(f"Updated {SCRIPT_PROMPT_KEY} in .env file")

        return {"message": "提示词已保存", "script_prompt": data.script_prompt}

    except Exception as e:
        logger.error(f"Failed to update script prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))
