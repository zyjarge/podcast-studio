"""
使用异步 API 并发生成播客音频
同时提交多个任务，显著提升效率
"""
import os
import re
import time
import subprocess
import requests
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from datetime import datetime

# 加载环境变量
load_dotenv()

API_KEY = os.getenv("MINIMAX_API_KEY")
VOICE_IDS = {
    "luoyonghao": "luoyonghao2",
    "wangziru": "wangziru_test"
}

# API 端点
UPLOAD_URL = "https://api.minimaxi.com/v1/files/upload"
T2A_ASYNC_URL = "https://api.minimaxi.com/v1/t2a_async_v2"
TASK_QUERY_URL = "https://api.minimaxi.com/v1/query/t2a_async_query_v2"

HEADERS = {"Authorization": f"Bearer {API_KEY}"}

# 并发控制
MAX_CONCURRENT = 5  # 最大并发数
semaphore = threading.Semaphore(MAX_CONCURRENT)


def upload_and_create_task(text: str, speaker: str, output_dir: str, task_idx: int) -> dict:
    """上传文本并创建任务，返回 task_info"""
    with semaphore:  # 限制并发数
        # 使用带索引的临时文件，避免并发冲突
        temp_file = os.path.join(output_dir, f"temp_text_{task_idx}.txt")

        # 上传文本
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(text)

        with open(temp_file, "rb") as f:
            files = {"file": ("temp_text.txt", f)}
            data = {"purpose": "t2a_async_input"}
            resp = requests.post(UPLOAD_URL, headers=HEADERS, data=data, files=files)

        os.remove(temp_file)
        file_id = resp.json()["file"]["file_id"]

        # 创建任务
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

        return {"index": 0, "task_id": task_id, "speaker": speaker, "text_preview": text[:20]}


def query_task(task_id: str) -> dict:
    """查询任务状态"""
    url = f"{TASK_QUERY_URL}?task_id={task_id}"
    resp = requests.get(url, headers=HEADERS)
    return resp.json()


def wait_task(task_id: str, max_wait: int = 600) -> str:
    """等待任务完成，返回 file_id"""
    start = time.time()
    while time.time() - start < max_wait:
        result = query_task(task_id)
        status = result.get("status", "")

        if status == "Success":
            return result.get("file_id")
        elif status == "Fail":
            raise Exception(f"任务失败: {task_id}")
        else:
            time.sleep(2)
    raise Exception(f"超时: {task_id}")


def download_audio(file_id: str) -> bytes:
    """下载音频"""
    url = f"https://api.minimaxi.com/v1/files/retrieve_content?file_id={file_id}"
    resp = requests.get(url, headers=HEADERS)
    return resp.content


def parse_dialogues(filename: str) -> list:
    """解析逐字稿"""
    with open(filename, "r", encoding="utf-8") as f:
        content = f.read()

    dialogues = []
    pattern = r"\*\*(罗永浩|王自如)：\*\*([^\*]+)"
    for match in re.finditer(pattern, content):
        speaker = "luoyonghao" if match.group(1) == "罗永浩" else "wangziru"
        dialogues.append({"speaker": speaker, "text": match.group(2).strip()})
    return dialogues


def main(date=None, indices=None):
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    input_dir = f"resource/{date}"
    output_dir = f"output/{date}"

    print("=" * 60)
    print("播客音频生成 - 并发版")
    print("=" * 60)
    print(f"输入目录: {input_dir}")
    print(f"输出目录: {output_dir}")

    # 解析对话
    input_file = os.path.join(input_dir, "talks.txt")
    dialogues = parse_dialogues(input_file)

    # 如果指定了 indices，只处理指定的对话
    if indices:
        # 过滤并重新编号
        dialogues = [d for i, d in enumerate(dialogues) if i in indices]
        # 重新编号索引
        for i, d in enumerate(dialogues):
            d["_original_idx"] = indices[i]

        print(f"\n将重新生成 {len(dialogues)} 个指定片段，原始索引: {indices}")
    else:
        print(f"\n共 {len(dialogues)} 轮对话，并发数: {MAX_CONCURRENT}")
    luo = sum(1 for d in dialogues if d["speaker"] == "luoyonghao")
    wang = sum(1 for d in dialogues if d["speaker"] == "wangziru")
    print(f"罗永浩: {luo} 次，王自如: {wang} 次\n")

    os.makedirs(output_dir, exist_ok=True)

    # === 阶段 1: 并发提交所有任务 ===
    print("=" * 60)
    print("[阶段 1] 并发提交任务...")
    print("=" * 60)

    tasks = []
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
        futures = {
            executor.submit(upload_and_create_task, d["text"], d["speaker"], output_dir, i): i
            for i, d in enumerate(dialogues)
        }

        for future in as_completed(futures):
            idx = futures[future]
            try:
                result = future.result()
                result["index"] = idx
                tasks.append(result)
                print(f"[{idx+1}/{len(dialogues)}] 已提交: {result['task_id']}")
            except Exception as e:
                print(f"[{idx}] 提交失败: {e}")

    # 按原始顺序排序
    tasks.sort(key=lambda x: x["index"])
    print(f"\n成功提交 {len(tasks)}/{len(dialogues)} 个任务")

    # === 阶段 2: 并发等待完成 ===
    print("\n" + "=" * 60)
    print("[阶段 2] 并发等待完成...")
    print("=" * 60)

    completed = []
    lock = threading.Lock()

    def process_task(task):
        task_id = task["task_id"]
        idx = task["index"]
        speaker = task["speaker"]

        try:
            print(f"[{idx+1}/{len(tasks)}] 等待中...")
            file_id = wait_task(task_id)
            with lock:
                task["file_id"] = file_id
                completed.append(task)
                print(f"[{idx+1}/{len(tasks)}] 完成! file_id={file_id}")
        except Exception as e:
            print(f"[{idx+1}/{len(tasks)}] 失败: {e}")

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
        executor.map(process_task, tasks)

    print(f"\n完成 {len(completed)}/{len(tasks)} 个任务")

    # === 阶段 3: 并发下载 ===
    print("\n" + "=" * 60)
    print("[阶段 3] 并发下载音频...")
    print("=" * 60)

    audio_parts = []
    lock2 = threading.Lock()

    def download_task(task):
        idx = task["index"]
        file_id = task.get("file_id")
        if not file_id:
            return

        # 使用原始索引（如果是重新生成）
        original_idx = task.get("_original_idx", idx)
        save_idx = original_idx if indices else idx

        try:
            audio = download_audio(file_id)
            path = f"{output_dir}/part_{save_idx+1:03d}.mp3"
            with open(path, "wb") as f:
                f.write(audio)
            with lock2:
                audio_parts.append(path)
                print(f"[{idx+1}/{len(completed)}] 下载完成: {path}")
        except Exception as e:
            print(f"[{idx+1}] 下载失败: {e}")

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
        executor.map(download_task, completed)

    # === 阶段 4: 拼接音频 ===
    print("\n" + "=" * 60)
    print("[阶段 4] 拼接音频...")
    print("=" * 60)

    # 按索引排序
    audio_parts.sort(key=lambda x: int(os.path.basename(x).split('_')[1].split('.')[0]))

    # 创建文件列表
    list_file = f"{output_dir}/concat_list.txt"
    with open(list_file, "w") as f:
        for path in audio_parts:
            f.write(f"file '{os.path.abspath(path)}'\n")

    # ffmpeg 拼接
    output_path = f"{output_dir}/{date}.mp3"
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", output_path]
    subprocess.run(cmd, check=True)
    os.remove(list_file)

    print(f"\n" + "=" * 60)
    print("[完成]")
    print(f"  输出文件: {output_path}")
    print(f"  总段数: {len(audio_parts)}")
    print("=" * 60)


def concat_audio(date: str):
    """仅执行拼接操作"""
    import subprocess

    output_dir = f"output/{date}"
    audio_parts = []

    # 收集所有 part 文件
    for f in sorted(os.listdir(output_dir)):
        if f.startswith("part_") and f.endswith(".mp3"):
            part_path = os.path.join(output_dir, f)
            audio_parts.append(part_path)

    if not audio_parts:
        print("未找到需要拼接的音频片段")
        return

    # 按索引排序
    audio_parts.sort(key=lambda x: int(os.path.basename(x).split('_')[1].split('.')[0]))

    # 创建文件列表
    list_file = f"{output_dir}/concat_list.txt"
    with open(list_file, "w") as f:
        for path in audio_parts:
            f.write(f"file '{os.path.abspath(path)}'\n")

    # ffmpeg 拼接
    output_path = f"{output_dir}/{date}.mp3"
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", output_path]
    subprocess.run(cmd, check=True)
    os.remove(list_file)

    print(f"\n拼接完成: {output_path}")
    print(f"共 {len(audio_parts)} 个片段")


def print_help():
    """打印使用帮助"""
    help_text = """
================================================================================
播客音频生成工具 - 使用帮助
================================================================================

【基本用法】
  python talks_podcast_async_parallel.py [日期] [选项]

【日期参数】
  不指定日期        使用今天的日期
  2026-01-17       使用指定的日期

【选项】
  --help, -h       打印此帮助信息
  --concat         仅执行音频拼接操作
  --indices N1,N2  重新生成指定的对话片段（用逗号分隔）

【使用示例】

  # 1. 生成今天的播客音频
  python talks_podcast_async_parallel.py

  # 2. 生成指定日期的播客音频
  python talks_podcast_async_parallel.py 2026-01-17

  # 3. 重新生成第55和62条对话
  python talks_podcast_async_parallel.py --indices 55,62

  # 4. 重新生成后拼接
  python talks_podcast_async_parallel.py --indices 55,62
  python talks_podcast_async_parallel.py 2026-01-17 --concat

  # 5. 仅执行拼接操作
  python talks_podcast_async_parallel.py --concat
  python talks_podcast_async_parallel.py 2026-01-17 --concat

【工作流程】

  输入文件:  resource/{日期}/talks.txt
  输出目录:  output/{日期}/
  片段文件:  output/{日期}/part_001.mp3 ...
  完整音频:  output/{日期}/{日期}.mp3

【注意事项】

  - 片段文件以 part_ 开头，拼接后会合并为 {日期}.mp3
  - 使用 --indices 重新生成片段后，需再次运行 --concat 拼接
  - 每次运行会覆盖同名文件

================================================================================
"""
    print(help_text)


if __name__ == "__main__":
    import sys

    date = None
    indices = None
    concat_only = False

    # 解析参数
    args = sys.argv[1:]

    # 检查是否需要打印帮助
    if "--help" in args or "-h" in args:
        print_help()
        sys.exit(0)

    # 解析其他参数
    if args:
        if not args[0].startswith("--"):
            date = args[0]
            args = args[1:]

        for i, arg in enumerate(args):
            if arg == "--indices" and i + 1 < len(args):
                try:
                    indices = [int(x.strip()) for x in args[i + 1].split(",")]
                    print(f"将重新生成对话片段索引: {indices}")
                except ValueError:
                    print("错误: indices 参数格式错误，应为 --indices 55,62")
                    sys.exit(1)
            elif arg == "--concat":
                concat_only = True

    if concat_only:
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        print(f"仅执行拼接操作，日期: {date}")
        concat_audio(date)
    else:
        main(date, indices)
