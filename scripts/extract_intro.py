#!/usr/bin/env python3
"""
截取 Intro 音乐并添加淡入淡出效果
"""
import os
import subprocess

# 配置
SOURCE_MP3 = "/Users/zhangyong/Downloads/lkoliks-upbeat-energetic-background-music-337963.mp3"
OUTPUT_INTRO = "voices/intro.mp3"
DURATION = 7  # 秒
FADE_IN = 1.5  # 淡入秒数
FADE_OUT = 1.5  # 淡出秒数（用于与下一段音频衔接）


def extract_with_fade():
    """截取并添加淡入淡出效果"""
    if not os.path.exists(SOURCE_MP3):
        print(f"❌ 源文件不存在: {SOURCE_MP3}")
        return

    # FFmpeg 命令：截取 + 淡入淡出
    cmd = [
        "ffmpeg", "-y",
        "-i", SOURCE_MP3,
        "-ss", "0",
        "-t", str(DURATION),
        "-af", f"afade=t=in:ss=0:d={FADE_IN},afade=t=out:ss={DURATION - FADE_OUT}:d={FADE_OUT}",
        OUTPUT_INTRO
    ]

    print(f"📝 执行命令: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        print(f"✅ Intro 已生成: {OUTPUT_INTRO}")
        print(f"   时长: {DURATION}秒")
        print(f"   淡入: {FADE_IN}秒, 淡出: {FADE_OUT}秒")
    else:
        print(f"❌ 失败: {result.stderr}")


if __name__ == "__main__":
    extract_with_fade()
