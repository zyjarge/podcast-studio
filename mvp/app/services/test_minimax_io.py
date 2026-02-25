"""使用 MiniMax.io 生成播客音频测试"""
import os
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import re
from dataclasses import dataclass
from pydub import AudioSegment
import requests
import time


@dataclass
class Dialogue:
    speaker: str
    text: str
    index: int


# MiniMax.io 配置 (海外版)
API_KEY = os.getenv("MINIMAX_IO_API_KEY")
VOICE_IDS = {
    "罗永浩": os.getenv("MINIMAX_VOICE_LUO", "罗永浩"),
    "王自如": os.getenv("MINIMAX_VOICE_ZIRU", ""),
}

UPLOAD_URL = "https://api.minimax.io/v1/files/upload"
T2A_URL = "https://api.minimax.io/v1/t2a_async_v2"
QUERY_URL = "https://api.minimax.io/v1/query/t2a_async_query_v2"


def parse_script(script_path: str) -> list[Dialogue]:
    """解析播客脚本"""
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()

    dialogues = []
    # 每一段以 **名字：** 开头
    pattern = re.compile(r'\*\*(.+?)[：:]\s*(.+?)(?=\n\*\*|$)', re.DOTALL)
    matches = pattern.findall(content)

    for idx, (speaker, text) in enumerate(matches):
        # 清理文本中多余的 **xxx**
        text = re.sub(r'\*\*', '', text)
        text = text.strip()

        # 标准化说话人名称
        if "罗永浩" in speaker:
            speaker = "罗永浩"
        elif "王自如" in speaker or "自如" in speaker:
            speaker = "王自如"

        dialogues.append(Dialogue(speaker=speaker, text=text, index=idx))

    return dialogues


def upload_text(text: str) -> str:
    """上传文本文件"""
    with open('temp_text.txt', 'w', encoding='utf-8') as f:
        f.write(text)

    with open('temp_text.txt', 'rb') as f:
        files = {"file": ("text.txt", f)}
        data = {"purpose": "t2a_async_input"}
        resp = requests.post(
            UPLOAD_URL,
            headers={"Authorization": f"Bearer {API_KEY}"},
            files=files, data=data
        )

    os.unlink('temp_text.txt')
    return resp.json()["file"]["file_id"]


def submit_task(file_id: str, voice_id: str) -> str:
    """提交 TTS 任务"""
    payload = {
        "model": "speech-2.8-hd",
        "text_file_id": file_id,
        "voice_setting": {
            "voice_id": voice_id,
            "speed": 1.0,
            "vol": 1.0,
            "pitch": 0
        },
        "audio_setting": {
            "sample_rate": 32000,
            "format": "mp3",
            "bitrate": 128000,
            "channel": 1
        }
    }

    resp = requests.post(
        T2A_URL,
        headers={"Authorization": f"Bearer {API_KEY}"},
        json=payload
    )
    return resp.json().get("task_id")


def query_task(task_id: str) -> str:
    """查询任务状态，返回 file_id 或状态"""
    resp = requests.get(
        f"{QUERY_URL}?task_id={task_id}",
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    result = resp.json()
    status = result.get("status", "")

    if status == "Success":
        return result.get("file_id")
    elif status == "Fail":
        raise Exception(f"MiniMax 任务失败: {result}")
    return status


def download_audio(file_id: str) -> bytes:
    """下载音频"""
    url = f"https://api.minimax.io/v1/files/retrieve_content?file_id={file_id}"
    resp = requests.get(url, headers={"Authorization": f"Bearer {API_KEY}"})
    return resp.content


def generate_audio(dialogue: Dialogue, output_dir: str) -> str:
    """生成单个音频片段"""
    voice_id = VOICE_IDS.get(dialogue.speaker)
    if not voice_id:
        raise ValueError(f"未配置 {dialogue.speaker} 的 voice_id")

    print(f"  [{dialogue.index + 1}] {dialogue.speaker}: {dialogue.text[:30]}...")

    # 上传文本
    file_id = upload_text(dialogue.text)

    # 提交任务
    task_id = submit_task(file_id, voice_id)
    print(f"       Task ID: {task_id}")

    # 轮询等待
    while True:
        status = query_task(task_id)
        if status != "Processing" and status != "Waiting":
            break
        time.sleep(2)

    if isinstance(status, str):
        raise Exception(f"未知状态: {status}")

    # 下载音频
    audio_content = download_audio(status)
    output_path = os.path.join(output_dir, f"part_{dialogue.index + 1:03d}.mp3")

    with open(output_path, 'wb') as f:
        f.write(audio_content)

    print(f"       -> {output_path}")
    return output_path


def merge_audio(audio_files: list[str], output_path: str):
    """合并音频片段"""
    combined = AudioSegment.silent(duration=0)

    for f in sorted(audio_files):
        audio = AudioSegment.from_mp3(f)
        # 添加 500ms 间隔
        combined += audio + AudioSegment.silent(duration=500)

    combined.export(output_path, format="mp3")
    print(f"\n合并完成: {output_path}")


def main():
    script_path = "data/output/2026-02-05/talks_sample.txt"
    output_dir = "data/output/2026-02-05/splits_io"
    output_path = "data/output/2026-02-05/test_output_io.mp3"

    # 解析脚本
    dialogues = parse_script(script_path)
    print(f"解析到 {len(dialogues)} 段对话\n")

    for d in dialogues:
        voice_id = VOICE_IDS.get(d.speaker, "未配置")
        print(f"  [{d.index + 1}] {d.speaker}: {d.text[:40]}... (voice_id: {voice_id})")

    # 检查 voice_id
    for d in dialogues:
        if not VOICE_IDS.get(d.speaker):
            print(f"\n警告: {d.speaker} 未配置 voice_id")
            return

    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)

    # 生成音频
    print("\n开始生成音频...")
    audio_files = []
    for d in dialogues:
        path = generate_audio(d, output_dir)
        audio_files.append(path)

    # 合并音频
    print("\n合并音频...")
    merge_audio(audio_files, output_path)


if __name__ == "__main__":
    main()
