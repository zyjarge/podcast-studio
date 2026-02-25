"""
播客生成流水线
整合：RSS -> LLM -> TTS -> 合并音频

目录结构：
data/output/{date}/
    - news.txt      (抓取的新闻源稿)
    - show_notes.md (节目笔记)
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


def _generate_show_notes(news_items: list, output_path: str, date: str):
    """生成 show_notes.md（仅标题和摘要）"""
    content = [f"# 科技双响炮 - {date}\n"]
    content.append("## 本期新闻\n")

    for i, item in enumerate(news_items, 1):
        title = item.title.strip() if hasattr(item, 'title') else item.get('title', '')
        summary = item.summary.strip() if hasattr(item, 'summary') else item.get('summary', '')
        content.append(f"### {i}. {title}\n")
        content.append(f"{summary}\n")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content))

    print(f"已生成: {output_path}")


def run_pipeline(date: str = None, rss_url: str = None, no_tts: bool = False, skip_fetch: bool = False):
    """
    运行完整流水线

    Args:
        date: 日期字符串，如 "2026-02-05"
        rss_url: RSS 订阅地址
        no_tts: 跳过 TTS 阶段（仅新闻+逐字稿）
        skip_fetch: 跳过新闻抓取，使用已有的 news.txt
    """
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    if rss_url is None:
        rss_url = os.getenv("RSS_URL", "")
        if not rss_url:
            print("错误: 请在 .env 文件中配置 RSS_URL")
            return

    # 目录结构
    base_dir = f"data/output/{date}"
    news_path = os.path.join(base_dir, "news.txt")
    show_notes_path = os.path.join(base_dir, "show_notes.md")
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

    from app.services.rss import RSSService, RSSItem

    news_items = []
    try:
        if skip_fetch:
            # 跳过抓取，使用已有的 news.txt
            if not os.path.exists(news_path):
                print(f"错误: news.txt 不存在: {news_path}")
                return
            print(f"跳过抓取，使用已有新闻: {news_path}")

            # 解析已有的 news.txt
            with open(news_path, "r", encoding="utf-8") as f:
                content = f.read()

            # 简单解析格式：新闻N: 标题 / URL: xxx / 摘要: xxx
            items = content.strip().split("\n\n")
            for item_text in items:
                lines = item_text.strip().split("\n")
                news_item = RSSItem(
                    title=lines[0].split(":", 1)[1].strip() if ":" in lines[0] else "",
                    url=lines[1].replace("URL:", "").strip() if len(lines) > 1 else "",
                    summary=lines[2].replace("摘要:", "").strip() if len(lines) > 2 else ""
                )
                news_items.append(news_item)

            print(f"已加载 {len(news_items)} 条新闻")
        else:
            # 正常抓取
            rss_service = RSSService()
            news_items = rss_service.fetch_sync(rss_url, limit=10)

            # 保存新闻源稿
            with open(news_path, "w", encoding="utf-8") as f:
                for i, item in enumerate(news_items, 1):
                    f.write(f"新闻{i}: {item.title}\n")
                    f.write(f"URL: {item.url}\n")
                    f.write(f"摘要: {item.summary}\n")
                    f.write("\n")

            print(f"获取到 {len(news_items)} 条新闻")
            print(f"已保存: {news_path}")

        # 生成 show_notes.md
        _generate_show_notes(news_items, show_notes_path, date)

    except Exception as e:
        logger.error(f"获取新闻失败: {e}")
        return

    # === 阶段 2: 生成逐字稿 ===
    print("\n" + "=" * 70)
    print("[阶段 2] 生成逐字稿...")
    print("=" * 70)

    from app.services.llm import generate_podcast_script, get_intro

    try:
        # 生成正文（不含开场白）
        body = generate_podcast_script(news_items)

        # 添加固定开场白
        intro = get_intro()
        script = f"{intro}\n\n{body}"

        # 保存逐字稿
        with open(talks_path, "w", encoding="utf-8") as f:
            f.write(script)

        print(f"逐字稿已生成 ({len(script)} 字)")
        print(f"已保存: {talks_path}")

    except Exception as e:
        logger.error(f"生成逐字稿失败: {e}")
        return

    # === 阶段 3: TTS 生成 ===
    if no_tts:
        print("\n" + "=" * 70)
        print("[跳过] TTS 阶段 (--no-tts)")
        print("=" * 70)
        print("\n" + "=" * 70)
        print("[完成]")
        print("=" * 70)
        print(f"日期: {date}")
        print(f"新闻: {len(news_items)} 条")
        print(f"逐字稿: {talks_path}")
        print("=" * 70)
        return

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

        _prepend_intro(splits_dir, audio_parts, audio_path)
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


def _prepend_intro(splits_dir: str, audio_parts: list, final_output: str, skip_existing: bool = True) -> bool:
    """
    两步合并：
    1. 先合并正文 part_001 ~ part_n 到临时文件
    2. 再将 intro 和正文合并
    """
    intro_path = "voices/intro/intro_final.mp3"
    if not os.path.exists(intro_path):
        print(f"警告: Intro 文件不存在: {intro_path}")
        return False

    # 过滤出正文片段（排除 part_000）
    body_parts = [p for p in audio_parts if not os.path.basename(p).startswith("part_000")]
    if not body_parts:
        print("没有正文片段")
        return False

    # 第一步：合并正文到临时文件
    body_path = os.path.join(splits_dir, "body_temp.mp3")
    from app.services.tts import MiniMaxTTSService
    tts = MiniMaxTTSService()
    tts.merge_audio(body_parts, body_path, skip_existing=skip_existing)

    # 第二步：intro + 正文 合并
    return tts.merge_with_intro(intro_path, body_path, final_output, skip_existing=skip_existing)


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
    audio_parts = tts.batch_generate(dialogues, splits_dir)

    if audio_parts:
        audio_path = os.path.join(base_dir, f"{date}.mp3")
        _prepend_intro(splits_dir, audio_parts, audio_path)
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
    _prepend_intro(splits_dir, audio_parts, audio_path)


def cmd_generate_script(date: str):
    """
    单步命令：仅生成逐字稿
    """
    base_dir = f"data/output/{date}"
    news_path = os.path.join(base_dir, "news.txt")
    talks_path = os.path.join(base_dir, "talks.txt")

    if not os.path.exists(news_path):
        print(f"错误: news.txt 不存在: {news_path}")
        return

    print("=" * 70)
    print(f"生成逐字稿 - {date}")
    print("=" * 70)

    # 解析 news.txt
    from app.services.rss import RSSItem
    news_items = []
    with open(news_path, "r", encoding="utf-8") as f:
        content = f.read()

    items = content.strip().split("\n\n")
    for item_text in items:
        lines = item_text.strip().split("\n")
        if len(lines) >= 3:
            news_items.append(RSSItem(
                title=lines[0].split(":", 1)[1].strip() if ":" in lines[0] else "",
                url=lines[1].replace("URL:", "").strip(),
                summary=lines[2].replace("摘要:", "").strip()
            ))

    print(f"已加载 {len(news_items)} 条新闻")

    # 生成逐字稿
    from app.services.llm import generate_podcast_script, get_intro
    body = generate_podcast_script(news_items)
    intro = get_intro()
    script = f"{intro}\n\n{body}"

    with open(talks_path, "w", encoding="utf-8") as f:
        f.write(script)

    print(f"逐字稿已生成: {talks_path}")
    print(f"字数: {len(script)}")


def cmd_generate_audio(date: str):
    """
    单步命令：仅生成音频（需要逐字稿）
    """
    base_dir = f"data/output/{date}"
    talks_path = os.path.join(base_dir, "talks.txt")
    splits_dir = os.path.join(base_dir, "splits")

    if not os.path.exists(talks_path):
        print(f"错误: talks.txt 不存在: {talks_path}")
        return

    print("=" * 70)
    print(f"生成音频 - {date}")
    print("=" * 70)

    from app.services.tts import MiniMaxTTSService
    tts = MiniMaxTTSService()

    dialogues = tts.parse_dialogues(talks_path)
    print(f"解析到 {len(dialogues)} 段对话")

    audio_parts = tts.batch_generate(dialogues, splits_dir)

    if audio_parts:
        print(f"已生成 {len(audio_parts)} 个音频片段")
    else:
        print("没有新片段需要生成")


def cmd_generate_shownotes(date: str):
    """
    单步命令：仅生成 show_notes.md
    """
    base_dir = f"data/output/{date}"
    news_path = os.path.join(base_dir, "news.txt")
    show_notes_path = os.path.join(base_dir, "show_notes.md")

    if not os.path.exists(news_path):
        print(f"错误: news.txt 不存在: {news_path}")
        return

    print("=" * 70)
    print(f"生成 show_notes - {date}")
    print("=" * 70)

    # 解析 news.txt
    from app.services.rss import RSSItem
    news_items = []
    with open(news_path, "r", encoding="utf-8") as f:
        content = f.read()

    items = content.strip().split("\n\n")
    for item_text in items:
        lines = item_text.strip().split("\n")
        if len(lines) >= 3:
            news_items.append(RSSItem(
                title=lines[0].split(":", 1)[1].strip() if ":" in lines[0] else "",
                url=lines[1].replace("URL:", "").strip(),
                summary=lines[2].replace("摘要:", "").strip()
            ))

    _generate_show_notes(news_items, show_notes_path, date)
    print(f"已生成 {len(news_items)} 条新闻记录")
    tts = MiniMaxTTSService()
    _prepend_intro(splits_dir, audio_parts, audio_path)


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
  --no-tts         跳过 TTS 阶段（仅新闻+逐字稿）
  --skip-fetch     跳过新闻抓取，使用已有的 news.txt
  --script         单步：仅生成逐字稿（需要 news.txt）
  --audio          单步：仅生成音频片段（需要 talks.txt）
  --shownotes      单步：仅生成 show_notes（需要 news.txt）
  --rss URL        指定 RSS 订阅地址

【使用示例】

  # 1. 运行完整流水线（获取新闻 -> 生成逐字稿 -> TTS -> 合并）
  python podcast_pipeline.py

  # 2. 指定日期
  python podcast_pipeline.py 2026-01-17

  # 3. 指定 RSS 源
  python podcast_pipeline.py --rss https://example.com/feed.rss

  # 4. 单步命令
  python podcast_pipeline.py --script           # 生成逐字稿
  python podcast_pipeline.py --audio            # 生成音频片段
  python podcast_pipeline.py --shownotes        # 生成 show_notes

  # 5. 跳过某些阶段
  python podcast_pipeline.py --no-tts           # 跳过 TTS
  python podcast_pipeline.py --skip-fetch       # 跳过抓取，使用 news.txt
  python podcast_pipeline.py --audio-only       # 跳过 LLM，直接 TTS

  # 6. 仅合并音频
  python podcast_pipeline.py --merge-only

【输出目录结构】

  data/output/{date}/
      news.txt      - 抓取的新闻源稿
      talks.txt     - 生成的逐字稿
      splits/       - 音频片段 (part_001.mp3...)
      {date}.mp3    - 合并后的音频

【注意事项】

  - 每次运行会覆盖同名文件
  - 使用 --skip-fetch 前需确保 news.txt 已存在
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
    no_tts = False
    skip_fetch = False
    cmd_script = False
    cmd_audio = False
    cmd_shownotes = False

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
        elif arg == "--no-tts":
            no_tts = True
            i += 1
        elif arg == "--skip-fetch":
            skip_fetch = True
            i += 1
        elif arg == "--script":
            cmd_script = True
            i += 1
        elif arg == "--audio":
            cmd_audio = True
            i += 1
        elif arg == "--shownotes":
            cmd_shownotes = True
            i += 1
        else:
            i += 1

    # 默认日期
    if date is None:
        date = datetime.now().strftime("%Y-%m-%d")

    # 执行单步命令
    if cmd_script:
        cmd_generate_script(date)
    elif cmd_audio:
        cmd_generate_audio(date)
    elif cmd_shownotes:
        cmd_generate_shownotes(date)
    elif merge_only:
        merge_audio_only(date)
    elif audio_only:
        generate_audio_only(date)
    else:
        run_pipeline(date, rss_url, no_tts, skip_fetch)


if __name__ == "__main__":
    main()
