"""
播客生成流水线
整合：RSS -> LLM -> TTS -> 合并音频

目录结构：
data/output/{date}/
    - news.txt      (抓取的新闻源稿)
    - talks.txt      (生成的逐字稿)
    - splits/        (音频片段)
    - {date}.mp3     (合并后的音频)
"""
import os
import sys
import json
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger(__name__)


def run_pipeline(date: str = None, rss_url: str = None):
    """
    运行完整流水线

    Args:
        date: 日期字符串，如 "2026-02-05"
        rss_url: RSS 订阅地址
    """
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    if rss_url is None:
        rss_url = "https://kejikuaixun.blogspot.com/feeds/posts/default?alt=rss"

    # 目录结构
    base_dir = f"data/output/{date}"
    news_path = os.path.join(base_dir, "news.txt")
    talks_path = os.path.join(base_dir, "talks.txt")
    splits_dir = os.path.join(base_dir, "splits")
    audio_path = os.path.join(base_dir, f"{date}.mp3")

    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(splits_dir, exist_ok=True)

    print("=" * 70)
    print(f"播客生成流水线 - {date}")
    print("=" * 70)
    print(f"RSS: {rss_url}")
    print(f"输出目录: {base_dir}")

    # === 阶段 1: 获取新闻 ===
    print("\n" + "=" * 70)
    print("[阶段 1] 获取新闻...")
    print("=" * 70)

    from app.services.rss import RSSService

    rss_service = RSSService()
    news_items = []
    try:
        news_items = rss_service.fetch_sync(rss_url, limit=20)

        # 保存新闻源稿
        with open(news_path, "w", encoding="utf-8") as f:
            for i, item in enumerate(news_items, 1):
                f.write(f"新闻{i}: {item.title}\n")
                f.write(f"URL: {item.url}\n")
                f.write(f"摘要: {item.summary}\n")
                f.write("\n")

        print(f"获取到 {len(news_items)} 条新闻")
        print(f"已保存: {news_path}")

    except Exception as e:
        logger.error(f"获取新闻失败: {e}")
        return

    # === 阶段 2: 生成逐字稿 ===
    print("\n" + "=" * 70)
    print("[阶段 2] 生成逐字稿...")
    print("=" * 70)

    from app.services.llm import generate_podcast_script

    try:
        script = generate_podcast_script(news_items)

        # 保存逐字稿
        with open(talks_path, "w", encoding="utf-8") as f:
            f.write(script)

        print(f"逐字稿已生成 ({len(script)} 字)")
        print(f"已保存: {talks_path}")

    except Exception as e:
        logger.error(f"生成逐字稿失败: {e}")
        return

    # === 阶段 3: TTS 生成 ===
    print("\n" + "=" * 70)
    print("[阶段 3] 生成音频...")
    print("=" * 70)

    from app.services.tts import MiniMaxTTSService

    tts = MiniMaxTTSService()

    # 解析对话
    dialogues = tts.parse_script(script)
    print(f"解析到 {len(dialogues)} 段对话")

    luo = sum(1 for d in dialogues if d.speaker == "luoyonghao")
    wang = sum(1 for d in dialogues if d.speaker == "wangziru")
    print(f"罗永浩: {luo} 次，王自如: {wang} 次\n")

    # 生成音频片段
    audio_parts = tts.batch_generate(dialogues, splits_dir)

    if audio_parts:
        # 合并音频
        print("\n" + "=" * 70)
        print("[阶段 4] 合并音频...")
        print("=" * 70)

        tts.merge_audio(audio_parts, audio_path)
        print(f"\n完成! 输出: {audio_path}")

    # === 完成 ===
    print("\n" + "=" * 70)
    print("[完成]")
    print("=" * 70)
    print(f"日期: {date}")
    print(f"新闻: {len(news_items)} 条")
    print(f"对话: {len(dialogues)} 段")
    print(f"音频: {audio_path}")
    print("=" * 70)


def generate_audio_only(date: str):
    """
    仅生成音频（跳过 LLM）
    适用于逐字稿已生成的情况
    """
    base_dir = f"data/output/{date}"
    talks_path = os.path.join(base_dir, "talks.txt")

    if not os.path.exists(talks_path):
        print(f"错误: 逐字稿文件不存在: {talks_path}")
        return

    print("=" * 70)
    print(f"仅生成音频 - {date}")
    print("=" * 70)

    from app.services.tts import MiniMaxTTSService

    tts = MiniMaxTTSService()
    dialogues = tts.parse_dialogues(talks_path)
    print(f"解析到 {len(dialogues)} 段对话")

    splits_dir = os.path.join(base_dir, "splits")
    audio_parts = tts.generate(dialogues, splits_dir)

    if audio_parts:
        audio_path = os.path.join(base_dir, f"{date}.mp3")
        tts.merge_audio(audio_parts, audio_path)
        print(f"\n完成: {audio_path}")


def merge_audio_only(date: str):
    """
    仅合并音频
    适用于音频片段已生成的情况
    """
    base_dir = f"data/output/{date}"
    splits_dir = os.path.join(base_dir, "splits")
    audio_path = os.path.join(base_dir, f"{date}.mp3")

    if not os.path.exists(splits_dir):
        print(f"错误: 片段目录不存在: {splits_dir}")
        return

    # 收集所有片段
    audio_parts = []
    for f in os.listdir(splits_dir):
        if f.startswith("part_") and f.endswith(".mp3"):
            audio_parts.append(os.path.join(splits_dir, f))

    if not audio_parts:
        print("未找到音频片段")
        return

    audio_parts.sort(key=lambda x: int(
        os.path.basename(x).split('_')[1].split('.')[0]
    ))

    from app.services.tts import MiniMaxTTSService
    tts = MiniMaxTTSService()
    tts.merge_audio(audio_parts, audio_path)


def print_help():
    """打印帮助"""
    help_text = """
================================================================================
播客生成流水线 - 使用帮助
================================================================================

【基本用法】
  python podcast_pipeline.py [日期] [选项]

【日期参数】
  不指定日期        使用今天的日期
  2026-01-17       使用指定的日期

【选项】
  --help, -h       打印此帮助信息
  --audio-only     仅生成音频（跳过 LLM）
  --merge-only     仅合并音频
  --rss URL        指定 RSS 订阅地址

【使用示例】

  # 1. 运行完整流水线（获取新闻 -> 生成逐字稿 -> TTS -> 合并）
  python podcast_pipeline.py

  # 2. 指定日期
  python podcast_pipeline.py 2026-01-17

  # 3. 指定 RSS 源
  python podcast_pipeline.py --rss https://example.com/feed.rss

  # 4. 仅生成音频（逐字稿已存在）
  python podcast_pipeline.py --audio-only
  python podcast_pipeline.py 2026-01-17 --audio-only

  # 5. 仅合并音频（片段已存在）
  python podcast_pipeline.py --merge-only
  python podcast_pipeline.py 2026-01-17 --merge-only

【输出目录结构】

  data/output/{date}/
      news.txt      - 抓取的新闻源稿
      talks.txt     - 生成的逐字稿
      splits/       - 音频片段 (part_001.mp3...)
      {date}.mp3    - 合并后的音频

【注意事项】

  - 每次运行会覆盖同名文件
  - 使用 --audio-only 前需确保 talks.txt 已存在
  - 使用 --merge-only 前需确保 splits/ 目录存在

================================================================================
"""
    print(help_text)


def main():
    """主入口"""
    args = sys.argv[1:]

    # 帮助
    if "--help" in args or "-h" in args:
        print_help()
        return

    # 解析参数
    date = None
    rss_url = None
    audio_only = False
    merge_only = False

    i = 0
    while i < len(args):
        arg = args[i]

        if not arg.startswith("--"):
            date = arg
            i += 1
        elif arg == "--rss" and i + 1 < len(args):
            rss_url = args[i + 1]
            i += 2
        elif arg == "--audio-only":
            audio_only = True
            i += 1
        elif arg == "--merge-only":
            merge_only = True
            i += 1
        else:
            i += 1

    # 默认日期
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    # 执行
    if merge_only:
        merge_audio_only(date)
    elif audio_only:
        generate_audio_only(date)
    else:
        run_pipeline(date, rss_url)


if __name__ == "__main__":
    main()
