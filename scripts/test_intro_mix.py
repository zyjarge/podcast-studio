#!/usr/bin/env python3
"""
测试 Intro 音乐与主播音频的自然融合
效果：
1. Intro音乐前5秒正常播放
2. 5秒后音乐淡出，同时主播声音淡入
3. 最终混合：主播80%，背景20%
"""
import os
import subprocess

# 配置
SOURCE_MUSIC = "voices/lkoliks-upbeat-energetic-background-music-337963.mp3"
SOURCE_VOICE = "data/output/2026-02-05/splits/part_001.mp3"
OUTPUT_MIXED = "voices/test_mixed.mp3"

# 时长配置
INTRO_DURATION = 5  # 音乐前5秒正常播放
MUSIC_FADE_DURATION = 3  # 音乐淡出3秒
VOICE_FADE_DURATION = 3  # 人声淡入3秒


def test_mix():
    """测试音乐与人声混合"""
    if not os.path.exists(SOURCE_MUSIC):
        print(f"❌ 音乐文件不存在: {SOURCE_MUSIC}")
        return
    if not os.path.exists(SOURCE_VOICE):
        print(f"❌ 人声文件不存在: {SOURCE_VOICE}")
        return

    # 获取人声时长
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        SOURCE_VOICE
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    voice_duration = float(result.stdout.strip())
    print(f"🎤 人声音频时长: {voice_duration:.2f}秒")

    # 计算音乐需要时长（与人声同长）
    music_duration = voice_duration

    # FFmpeg 复杂滤镜：
    # 1. 音乐：0-5秒100%，5-8秒淡出到20%，8秒后保持20%
    # 2. 人声：0-5秒静音，5-8秒淡入到80%，8秒后保持80%
    # 3. amix 混合

    cmd = [
        "ffmpeg", "-y",
        "-i", SOURCE_MUSIC,
        "-i", SOURCE_VOICE,
        "-filter_complex", f"""
        [0:a]atrim=0:{music_duration},asetpts=PTS-STARTPTS,
            afade=t=in:st=0:d=1,
            afade=t=out:st={INTRO_DURATION}:d={MUSIC_FADE_DURATION}:curve=log,
            volume=0.2[music];

        [1:a]atrim=0:{music_duration},asetpts=PTS-STARTPTS,
            asetpts=PTS-STARTPTS,
            afade=t=in:st={INTRO_DURATION}:d={VOICE_FADE_DURATION}:curve=log,
            volume=0.8[voice];

        [music][voice]amix=inputs=2:duration=longest:weights=1 1[mixed]
        """,
        "-map", "[mixed]",
        OUTPUT_MIXED
    ]

    print(f"\n📝 {' '.join(cmd)}")
    print(f"\n🎵 测试效果:")
    print(f"   - 音乐前 {INTRO_DURATION}秒: 100% 音量")
    print(f"   - {INTRO_DURATION}秒后: 音乐淡出至20%，人声淡入至80%")
    print(f"   - 淡出/淡入时长: {MUSIC_FADE_DURATION}秒")

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode == 0:
        print(f"\n✅ 混合成功: {OUTPUT_MIXED}")
        # 检查输出时长
        cmd2 = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            OUTPUT_MIXED
        ]
        result2 = subprocess.run(cmd2, capture_output=True, text=True)
        print(f"   输出时长: {float(result2.stdout.strip()):.2f}秒")
    else:
        print(f"❌ 失败:")
        print(result.stderr[-500:] if len(result.stderr) > 500 else result.stderr)


if __name__ == "__main__":
    test_mix()
