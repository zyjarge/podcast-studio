"""
TTS 服务抽象层
支持 MiniMax 和 ElevenLabs 可插拔切换

使用方式：
- 环境变量 TTS_PROVIDER=minimax   → 使用 MiniMax
- 环境变量 TTS_PROVIDER=elevenlabs → 使用 ElevenLabs
"""
import os
import abc
from typing import List
from dataclasses import dataclass

# 加载环境变量
from dotenv import load_dotenv
load_dotenv()

TTS_PROVIDER = os.getenv("TTS_PROVIDER", "minimax").lower()


@dataclass
class TTSResponse:
    """TTS 响应"""
    audio_path: str
    text: str
    speaker: str
    index: int


class BaseTTSService(abc.ABC):
    """TTS 服务抽象基类"""

    @abc.abstractmethod
    def generate(self, text: str, speaker: str, output_path: str) -> str:
        """生成单个音频片段"""
        pass

    @abc.abstractmethod
    def batch_generate(
        self,
        dialogues: List[dict],
        output_dir: str,
        skip_existing: bool = True
    ) -> List[str]:
        """批量生成音频片段"""
        pass


class MiniMaxTTSService(BaseTTSService):
    """MiniMax TTS 服务"""

    # 音色配置
    VOICE_IDS = {
        "luoyonghao": "luoyonghao2",
        "wangziru": "wangziru_test"
    }

    API_KEY = os.getenv("MINIMAX_API_KEY")
    UPLOAD_URL = "https://api.minimaxi.com/v1/files/upload"
    T2A_URL = "https://api.minimaxi.com/v1/t2a_async_v2"
    QUERY_URL = "https://api.minimaxi.com/v1/query/t2a_async_query_v2"

    def __init__(self, max_concurrent: int = 5):
        self.max_concurrent = max_concurrent
        self._init_client()

    def _init_client(self):
        import requests
        import threading
        import time

        self.requests = requests
        self.semaphore = threading.Semaphore(self.max_concurrent)

    def generate(self, text: str, speaker: str, output_path: str) -> str:
        """同步生成音频（需要上传 + 轮询）"""
        import tempfile

        with self.semaphore:
            # 上传文本
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(text)
                temp_path = f.name

            try:
                # 上传
                with open(temp_path, 'rb') as f:
                    files = {"file": ("text.txt", f)}
                    data = {"purpose": "t2a_async_input"}
                    resp = self.requests.post(
                        self.UPLOAD_URL,
                        headers={"Authorization": f"Bearer {self.API_KEY}"},
                        data=data, files=files
                    )
                file_id = resp.json()["file"]["file_id"]

                # 创建任务
                payload = {
                    "model": "speech-2.6-hd",
                    "text_file_id": file_id,
                    "voice_setting": {
                        "voice_id": self.VOICE_IDS[speaker],
                        "speed": 1.0, "vol": 1.0, "pitch": 0
                    },
                    "audio_setting": {
                        "sample_rate": 32000, "format": "mp3", "bitrate": 128000, "channel": 1
                    }
                }
                resp = self.requests.post(
                    self.T2A_URL,
                    headers={"Authorization": f"Bearer {self.API_KEY}"},
                    json=payload
                )
                task_id = resp.json().get("task_id")

                # 轮询等待
                while True:
                    result = self.requests.get(
                        f"{self.QUERY_URL}?task_id={task_id}",
                        headers={"Authorization": f"Bearer {self.API_KEY}"}
                    ).json()
                    status = result.get("status", "")
                    if status == "Success":
                        file_id = result.get("file_id")
                        break
                    elif status == "Fail":
                        raise Exception(f"MiniMax 任务失败: {task_id}")
                    time.sleep(2)

                # 下载
                audio_url = f"https://api.minimaxi.com/v1/files/retrieve_content?file_id={file_id}"
                audio = self.requests.get(audio_url).content

                with open(output_path, 'wb') as f:
                    f.write(audio)

                return output_path

            finally:
                os.unlink(temp_path)

    def batch_generate(
        self,
        dialogues: List[dict],
        output_dir: str,
        skip_existing: bool = True
    ) -> List[str]:
        """批量生成（MiniMax 使用异步模式更高效，这里简化为同步）"""
        import concurrent.futures

        os.makedirs(output_dir, exist_ok=True)

        # 过滤已存在的
        if skip_existing:
            dialogues = [
                d for d in dialogues
                if not os.path.exists(os.path.join(output_dir, f"part_{d['index']+1:03d}.mp3"))
            ]

        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_concurrent) as executor:
            futures = {
                executor.submit(
                    self.generate,
                    d["text"],
                    d["speaker"],
                    os.path.join(output_dir, f"part_{d['index']+1:03d}.mp3")
                ): d for d in dialogues
            }

            for future in concurrent.futures.as_completed(futures):
                d = futures[future]
                try:
                    path = future.result()
                    results.append(path)
                    print(f"[{d['index']+1}/{len(dialogues)}] 完成: {os.path.basename(path)}")
                except Exception as e:
                    print(f"[{d['index']+1}] 失败: {e}")

        return sorted(results)


class ElevenLabsTTSService(BaseTTSService):
    """ElevenLabs TTS 服务"""

    # 默认音色（可替换为克隆音色 ID）
    VOICE_IDS = {
        "luoyonghao": os.getenv("ELEVENLABS_VOICE_LUO", ""),      # 需替换为克隆音色 ID
        "wangziru": os.getenv("ELEVENLABS_VOICE_ZIRU", "")       # 需替换为克隆音色 ID
    }

    API_KEY = os.getenv("ELEVENLABS_API_KEY")
    BASE_URL = "https://api.elevenlabs.io/v1"

    def __init__(self, model: str = "eleven_monolingual_v1", max_concurrent: int = 3, timeout: int = 180):
        self.model = model
        self.max_concurrent = max_concurrent
        self.timeout = timeout
        self._init_client()

    def _init_client(self):
        import httpx
        import threading

        self.httpx = httpx
        self.semaphore = threading.Semaphore(self.max_concurrent)

    def generate(self, text: str, speaker: str, output_path: str) -> str:
        """同步生成音频（ElevenLabs 直接返回音频流）"""
        voice_id = self.VOICE_IDS.get(speaker)
        if not voice_id:
            raise ValueError(f"未配置 {speaker} 的 ElevenLabs 音色 ID")

        url = f"{self.BASE_URL}/text-to-speech/{voice_id}"

        headers = {
            "xi-api-key": self.API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }

        payload = {
            "text": text,
            "model_id": self.model,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5,
                "style": 0.0,
                "use_speaker_boost": True
            }
        }

        max_retries = 3
        for attempt in range(max_retries):
            try:
                with self.semaphore:
                    client = self.httpx.Client(timeout=self.timeout)
                    resp = client.post(url, json=payload, headers=headers)
                    resp.raise_for_status()

                    with open(output_path, 'wb') as f:
                        f.write(resp.content)

                    client.close()
                    return output_path

            except Exception as e:
                print(f"  ⚠️ 尝试 {attempt + 1}/{max_retries} 失败: {e}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(2)
                else:
                    raise Exception(f"生成失败，已重试 {max_retries} 次")

    def batch_generate(
        self,
        dialogues: List[dict],
        output_dir: str,
        skip_existing: bool = True
    ) -> List[str]:
        """批量生成"""
        import concurrent.futures

        os.makedirs(output_dir, exist_ok=True)

        # 过滤已存在的
        if skip_existing:
            dialogues = [
                d for d in dialogues
                if not os.path.exists(os.path.join(output_dir, f"part_{d['index']+1:03d}.mp3"))
            ]

        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_concurrent) as executor:
            futures = {
                executor.submit(
                    self.generate,
                    d["text"],
                    d["speaker"],
                    os.path.join(output_dir, f"part_{d['index']+1:03d}.mp3")
                ): d for d in dialogues
            }

            for future in concurrent.futures.as_completed(futures):
                d = futures[future]
                try:
                    path = future.result()
                    results.append(path)
                    print(f"[{d['index']+1}/{len(dialogues)}] 完成: {os.path.basename(path)}")
                except Exception as e:
                    print(f"[{d['index']+1}] 失败: {e}")

        return sorted(results)

    def list_voices(self) -> List[dict]:
        """列出可用音色"""
        url = f"{self.BASE_URL}/voices"
        headers = {"xi-api-key": self.API_KEY}

        resp = self.httpx.get(url, headers=headers)
        resp.raise_for_status()

        return resp.json().get("voices", [])

    def clone_voice(self, name: str, files: List[str]) -> str:
        """
        克隆音色（需要音频文件）

        Args:
            name: 音色名称
            files: 音频文件路径列表

        Returns:
            新创建的 voice_id
        """
        url = f"{self.BASE_URL}/voices/add"

        headers = {"xi-api-key": self.API_KEY}

        with open(files[0], 'rb') as f:
            files_data = {
                "files": (os.path.basename(files[0]), f, "audio/mpeg"),
                "name": (None, name),
                "description": (None, "Cloned voice"),
                "labels": (None, "{}")
            }
            resp = self.httpx.post(url, files=files_data, headers=headers)

        resp.raise_for_status()
        return resp.json().get("voice_id")


# ===== 工厂函数 =====

def get_tts_service(provider: str = None) -> BaseTTSService:
    """
    获取 TTS 服务实例

    Args:
        provider: 服务提供商 ("minimax" | "elevenlabs")

    Returns:
        TTS 服务实例
    """
    provider = (provider or TTS_PROVIDER).lower()

    if provider == "elevenlabs":
        return ElevenLabsTTSService()
    else:
        return MiniMaxTTSService()


# ===== 便捷函数 =====

def generate_podcast_audio(
    dialogues: List[dict],
    output_dir: str,
    provider: str = None
) -> List[str]:
    """
    生成播客音频

    Args:
        dialogues: 对话列表 [{"speaker": "luoyonghao", "text": "...", "index": 0}]
        output_dir: 输出目录
        provider: TTS 提供商

    Returns:
        音频文件路径列表
    """
    tts = get_tts_service(provider)
    return tts.batch_generate(dialogues, output_dir)
