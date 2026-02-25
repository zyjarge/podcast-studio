"""
批量根据 task_id 重新下载 TTS 音频

用法:
    python download_tasks.py task_id1 task_id2 task_id3 ...
    python download_tasks.py --file task_ids.txt
    python download_tasks.py --output-dir ./output task_id1 task_id2
"""
import os
import sys
import argparse
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# API 配置
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("MINIMAX_API_KEY")
TASK_QUERY_URL = "https://api.minimaxi.com/v1/query/t2a_async_query_v2"
TASK_QUERY_URL = "https://api.minimaxi.com/v1/query/t2a_async_query_v2"
DOWNLOAD_URL = "https://api.minimaxi.com/v1/files/retrieve_content"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

MAX_CONCURRENT = 5


def query_task(task_id: str) -> dict:
    """查询任务状态"""
    url = f"{TASK_QUERY_URL}?task_id={task_id}"
    resp = requests.get(url, headers=HEADERS)
    return resp.json()


def wait_task(task_id: str, max_wait: int = 600) -> str:
    """等待任务完成并返回 file_id"""
    import time
    start = time.time()
    while time.time() - start < max_wait:
        result = query_task(task_id)
        status = result.get("status", "")

        if status == "Success":
            return result.get("file_id")
        elif status == "Fail":
            raise Exception(f"任务失败: {task_id}, error: {result.get('extra', {}).get('message', '')}")
        else:
            time.sleep(2)
    raise Exception(f"超时: {task_id}")


def download_audio(file_id: str) -> bytes:
    """下载音频"""
    url = f"{DOWNLOAD_URL}?file_id={file_id}"
    resp = requests.get(url, headers=HEADERS)
    return resp.content


def process_single_task(task_id: str, output_dir: str, prefix: str = "") -> dict:
    """处理单个 task_id"""
    try:
        # 查询状态
        result = query_task(task_id)
        status = result.get("status", "")

        if status == "Success":
            file_id = result.get("file_id")
        elif status == "Pending" or status == "Processing":
            print(f"  [{prefix}] 任务进行中，等待完成...")
            file_id = wait_task(task_id)
        elif status == "Fail":
            print(f"  [{prefix}] 任务失败: {result.get('extra', {}).get('message', 'unknown')}")
            return {"task_id": task_id, "status": "fail", "message": result.get('extra', {}).get('message', '')}
        else:
            print(f"  [{prefix}] 未知状态: {status}")
            return {"task_id": task_id, "status": "unknown", "status_code": status}

        # 下载
        audio = download_audio(file_id)

        # 生成文件名
        filename = f"{prefix}.mp3" if prefix else f"{task_id}.mp3"
        filepath = os.path.join(output_dir, filename)

        with open(filepath, "wb") as f:
            f.write(audio)

        return {"task_id": task_id, "status": "success", "file": filepath}

    except Exception as e:
        return {"task_id": task_id, "status": "error", "message": str(e)}


def main():
    parser = argparse.ArgumentParser(description="批量根据 task_id 下载 TTS 音频")
    parser.add_argument("task_ids", nargs="*", help="task_id 列表")
    parser.add_argument("--file", "-f", help="包含 task_id 的文件（每行一个）")
    parser.add_argument("--output-dir", "-o", default="data/output/retry", help="输出目录")
    parser.add_argument("--prefix", "-p", default="", help="文件名前缀（如 part_001）")
    parser.add_argument("--concurrent", "-c", type=int, default=MAX_CONCURRENT, help="并发数")
    args = parser.parse_args()

    # 收集 task_ids
    task_ids = []

    if args.file:
        with open(args.file, "r") as f:
            task_ids = [line.strip() for line in f if line.strip()]
    elif args.task_ids:
        task_ids = args.task_ids
    else:
        print("用法: python download_tasks.py task_id1 task_id2 ...")
        print("   或: python download_tasks.py --file task_ids.txt")
        print("   或: python download_tasks.py --file task_ids.txt --output-dir ./output -p part_")
        sys.exit(1)

    print(f"共 {len(task_ids)} 个任务")
    print(f"输出目录: {args.output_dir}")
    os.makedirs(args.output_dir, exist_ok=True)

    # 并发下载
    results = []
    lock = threading.Lock()

    def process_with_prefix(idx, task_id):
        prefix = f"{args.prefix}{idx+1:03d}" if args.prefix else ""
        result = process_single_task(task_id, args.output_dir, prefix)
        with lock:
            results.append(result)
        return result

    with ThreadPoolExecutor(max_workers=args.concurrent) as executor:
        futures = {
            executor.submit(process_with_prefix, i, tid): tid
            for i, tid in enumerate(task_ids)
        }

        for future in as_completed(futures):
            tid = futures[future]
            try:
                result = future.result()
                if result["status"] == "success":
                    print(f"[✓] {tid} -> {result['file']}")
                elif result["status"] == "fail":
                    print(f"[✗] {tid} -> 失败: {result.get('message', '')}")
                elif result["status"] == "error":
                    print(f"[✗] {tid} -> 错误: {result.get('message', '')}")
            except Exception as e:
                print(f"[✗] {tid} -> 异常: {e}")

    # 统计
    success = sum(1 for r in results if r["status"] == "success")
    fail = sum(1 for r in results if r["status"] in ("fail", "error"))
    print(f"\n完成: 成功 {success}, 失败 {fail}")

    # 保存结果映射
    import json
    result_file = os.path.join(args.output_dir, "download_results.json")
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"结果已保存: {result_file}")


if __name__ == "__main__":
    main()
