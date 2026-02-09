"""MiniMax TTS 异步服务 - 基于 tts_base.py"""
import os
import re
import time
import subprocess
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import List, Optional

from .tts_base import BaseTTSService, get_tts_service

# API 配置
API_KEY = os.getenv("MINIMAX_API_KEY")
VOICE_IDS = {
    "luoyonghao": "luoyonghao2",
    "wangziru": "wangziru_test"
}

UPLOAD_URL = "https://api.minimaxi.com/v1/files/upload"
T2A_ASYNC_URL = "https://api.minimaxi.com/v1/t2a_async_v2"
TASK_QUERY_URL = "https://api.minimaxi.com/v1/query/t2a_async_query_v2"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

MAX_CONCURRENT = 5


@dataclass
class Dialogue:
    """对话片段"""
    speaker: str  # "luoyonghao" | "wangziru"
    text: str
    index: int  # 原始索引


class MiniMaxTTSService(BaseTTSService):
    """MiniMax 异步 TTS 服务"""

    def __init__(self, max_concurrent: int = MAX_CONCURRENT):
        self.max_concurrent = max_concurrent
        self.semaphore = threading.Semaphore(max_concurrent)

    def parse_dialogues(self, filename: str) -> List[Dialogue]:
        """解析逐字稿文件"""
        with open(filename, "r", encoding="utf-8") as f:
            content = f.read()
        return self._parse_content(content)

    def parse_script(self, script_content: str) -> List[Dialogue]:
        """解析逐字稿内容"""
        return self._parse_content(script_content)

    def _parse_content(self, content: str) -> List[Dialogue]:
        """解析内容为对话列表"""
        dialogues = []
        # 支持新旧两种格式：彪悍罗/OK王 或 罗永浩/王自如
        pattern = r"\*\*彪悍罗：\*\*([^\*]+)|\*\*OK王：\*\*([^\*]+)|\*\*罗永浩：\*\*([^\*]+)|\*\*王自如：\*\*([^\*]+)"

        for match in re.finditer(pattern, content):
            text = match.group(1) or match.group(2) or match.group(3) or match.group(4)
            # 彪悍罗/罗永浩 -> luoyonghao, OK王/王自如 -> wangziru
            if match.group(1) or match.group(3):
                speaker = "luoyonghao"
            else:
                speaker = "wangziru"
            dialogues.append(Dialogue(
                speaker=speaker,
                text=text.strip(),
                index=len(dialogues)
            ))
        return dialogues

    def _upload_and_create_task(self, text: str, speaker: str, task_idx: int) -> dict:
        """上传文本并创建任务"""
        import tempfile

        with self.semaphore:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(text)
                temp_path = f.name

            try:
                with open(temp_path, 'rb') as f:
                    files = {"file": ("temp_text.txt", f)}
                    data = {"purpose": "t2a_async_input"}
                    resp = requests.post(UPLOAD_URL, headers=HEADERS, data=data, files=files)

                file_id = resp.json()["file"]["file_id"]

                payload = {
                    "model": "speech-2.6-hd",
                    "text_file_id": file_id,
                    "voice_setting": {
                        "voice_id": VOICE_IDS[speaker],
                        "speed": 1.0, "vol": 1.0, "pitch": 0
                    },
                    "audio_setting": {
                        "sample_rate": 32000, "format": "mp3", "bitrate": 128000, "channel": 1
                    }
                }
                resp = requests.post(T2A_ASYNC_URL, headers=HEADERS, json=payload)
                task_id = resp.json().get("task_id")

                return {"index": task_idx, "task_id": task_id, "speaker": speaker}

            finally:
                os.unlink(temp_path)

    def _query_task(self, task_id: str) -> dict:
        """查询任务状态"""
        url = f"{TASK_QUERY_URL}?task_id={task_id}"
        resp = requests.get(url, headers=HEADERS)
        return resp.json()

    def _wait_task(self, task_id: str, max_wait: int = 600) -> str:
        """等待任务完成"""
        start = time.time()
        while time.time() - start < max_wait:
            result = self._query_task(task_id)
            status = result.get("status", "")

            if status == "Success":
                return result.get("file_id")
            elif status == "Fail":
                raise Exception(f"任务失败: {task_id}")
            else:
                time.sleep(2)
        raise Exception(f"超时: {task_id}")

    def _download_audio(self, file_id: str) -> bytes:
        """下载音频"""
        url = f"https://api.minimaxi.com/v1/files/retrieve_content?file_id={file_id}"
        resp = requests.get(url, headers=HEADERS)
        return resp.content

    def generate(self, text: str, speaker: str, output_path: str) -> str:
        """同步生成（不使用异步任务）"""
        raise NotImplementedError("请使用 batch_generate 异步模式")

    def batch_generate(
        self,
        dialogues: List[Dialogue],
        output_dir: str,
        skip_existing: bool = True
    ) -> List[str]:
        """批量生成"""
        os.makedirs(output_dir, exist_ok=True)

        # 过滤已存在的
        if skip_existing:
            dialogues = [d for d in dialogues if not os.path.exists(
                os.path.join(output_dir, f"part_{d.index+1:03d}.mp3")
            )]
            if dialogues:
                print(f"需生成 {len(dialogues)} 个片段")
            else:
                print("所有片段已存在")
                return []

        # === 阶段 1: 并发提交任务 ===
        print("=" * 60)
        print("[TTS] 阶段 1: 并发提交任务...")
        print("=" * 60)

        tasks = []
        with ThreadPoolExecutor(max_workers=self.max_concurrent) as executor:
            futures = {
                executor.submit(self._upload_and_create_task, d.text, d.speaker, d.index): d
                for d in dialogues
            }

            for future in as_completed(futures):
                d = futures[future]
                try:
                    result = future.result()
                    tasks.append(result)
                    print(f"[{d.index+1}/{len(dialogues)}] 已提交")
                except Exception as e:
                    print(f"[{d.index}] 失败: {e}")

        tasks.sort(key=lambda x: x["index"])
        print(f"\n成功提交 {len(tasks)}/{len(dialogues)} 个任务")

        # === 阶段 2: 并发等待完成 ===
        print("\n" + "=" * 60)
        print("[TTS] 阶段 2: 并发等待完成...")
        print("=" * 60)

        completed = []
        lock = threading.Lock()

        def process_task(task):
            task_id = task["task_id"]
            idx = task["index"]

            try:
                print(f"[{idx+1}/{len(tasks)}] 等待中...")
                file_id = self._wait_task(task_id)
                with lock:
                    task["file_id"] = file_id
                    completed.append(task)
                    print(f"[{idx+1}/{len(tasks)}] 完成!")
            except Exception as e:
                print(f"[{idx+1}/{len(tasks)}] 失败: {e}")

        with ThreadPoolExecutor(max_workers=self.max_concurrent) as executor:
            executor.map(process_task, tasks)

        print(f"\n完成 {len(completed)}/{len(tasks)} 个任务")

        # === 阶段 3: 并发下载 ===
        print("\n" + "=" * 60)
        print("[TTS] 阶段 3: 并发下载音频...")
        print("=" * 60)

        audio_parts = []
        lock2 = threading.Lock()

        def download_and_save(task):
            idx = task["index"]
            file_id = task.get("file_id")
            if not file_id:
                return

            try:
                audio = self._download_audio(file_id)
                path = os.path.join(output_dir, f"part_{idx+1:03d}.mp3")
                with open(path, "wb") as f:
                    f.write(audio)
                with lock2:
                    audio_parts.append(path)
                    print(f"[{idx+1}/{len(completed)}] 下载完成")
            except Exception as e:
                print(f"[{idx+1}] 下载失败: {e}")

        with ThreadPoolExecutor(max_workers=self.max_concurrent) as executor:
            executor.map(download_and_save, completed)

        return sorted(audio_parts)

    def merge_audio(self, audio_parts: List[str], output_path: str, skip_existing: bool = True) -> bool:
        """使用 FFmpeg 拼接音频（重新编码，避免文件头损坏问题）"""
        if not audio_parts:
            print("没有音频片段可拼接")
            return False

        # 如果输出已存在且跳过，跳过合并
        if skip_existing and os.path.exists(output_path):
            print(f"已存在，跳过合并: {output_path}")
            return True

        audio_parts.sort(key=lambda x: int(
            os.path.basename(x).split('_')[1].split('.')[0]
        ))

        list_file = os.path.join(os.path.dirname(audio_parts[0]), "concat_list.txt")
        with open(list_file, "w") as f:
            for path in audio_parts:
                f.write(f"file '{os.path.abspath(path)}'\n")

        # 重新编码合并，忽略文件头问题
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", list_file,
            "-acodec", "libmp3lame",
            "-q:a", "2",
            "-ar", "44100",
            "-ac", "2",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"合并失败: {result.stderr[-300:]}")
            os.remove(list_file)
            return False

        os.remove(list_file)
        print(f"拼接完成: {output_path}")
        print(f"共 {len(audio_parts)} 个片段")
        return True

    def merge_with_intro(self, intro_path: str, body_path: str, output_path: str, skip_existing: bool = True) -> bool:
        """将 intro 和正文合并"""
        if not os.path.exists(intro_path):
            print(f"警告: Intro 文件不存在: {intro_path}")
            return False

        if not os.path.exists(body_path):
            print(f"警告: 正文文件不存在: {body_path}")
            return False

        # 如果输出已存在且跳过，跳过合并
        if skip_existing and os.path.exists(output_path):
            print(f"已存在，跳过合并: {output_path}")
            return True

        # FFmpeg concat 合并
        list_file = os.path.join(os.path.dirname(body_path), "intro_concat.txt")
        with open(list_file, "w") as f:
            f.write(f"file '{os.path.abspath(intro_path)}'\n")
            f.write(f"file '{os.path.abspath(body_path)}'\n")

        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", list_file,
            "-acodec", "libmp3lame",
            "-q:a", "2",
            "-ar", "44100",
            "-ac", "2",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"合并失败: {result.stderr[-300:]}")
            os.remove(list_file)
            return False

        os.remove(list_file)
        print(f"已添加 Intro: {output_path}")
        return True


# ===== 兼容旧接口 =====

def parse_dialogues(filename: str) -> List[Dialogue]:
    """解析逐字稿文件"""
    tts = MiniMaxTTSService()
    return tts.parse_dialogues(filename)


def parse_script(script_content: str) -> List[Dialogue]:
    """解析逐字稿内容"""
    tts = MiniMaxTTSService()
    return tts.parse_script(script_content)


def generate_podcast_audio(
    dialogues: List[Dialogue],
    output_dir: str,
    merge: bool = True,
    provider: str = None
) -> str:
    """
    从对话列表生成播客音频

    Args:
        dialogues: 对话列表
        output_dir: 输出目录
        merge: 是否合并
        provider: TTS 提供商

    Returns:
        合并后的音频路径
    """
    # 转换为兼容格式
    raw_dialogues = [
        {"speaker": d.speaker, "text": d.text, "index": d.index}
        for d in dialogues
    ]

    splits_dir = os.path.join(output_dir, "splits")

    # 使用通用函数（支持切换 provider）
    if provider and provider != "minimax":
        audio_parts = generate_podcast_audio(raw_dialogues, splits_dir, provider=provider)
    else:
        tts = MiniMaxTTSService()
        audio_parts = tts.batch_generate(dialogues, splits_dir)

    if merge and audio_parts:
        date = os.path.basename(output_dir)
        output_path = os.path.join(output_dir, f"{date}.mp3")
        MiniMaxTTSService().merge_audio(audio_parts, output_path)
        return output_path

    return ""


def main():
    """测试函数"""
    import sys

    date = sys.argv[1] if len(sys.argv) > 1 else "2026-02-05"
    base_dir = f"data/output/{date}"
    script_path = os.path.join(base_dir, "talks.txt")

    if not os.path.exists(script_path):
        print(f"错误: 文件不存在: {script_path}")
        return

    print("=" * 60)
    print("播客音频生成")
    print("=" * 60)
    print(f"逐字稿: {script_path}")

    dialogues = parse_dialogues(script_path)
    print(f"解析到 {len(dialogues)} 段对话")

    luo = sum(1 for d in dialogues if d.speaker == "luoyonghao")
    wang = sum(1 for d in dialogues if d.speaker == "wangziru")
    print(f"罗永浩: {luo} 次，王自如: {wang} 次\n")

    output_path = generate_podcast_audio(dialogues, base_dir)
    print(f"\n完成: {output_path}")


if __name__ == "__main__":
    main()
