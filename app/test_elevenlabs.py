"""
ElevenLabs TTS 测试脚本
使用克隆的音色生成测试音频
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

from app.services.tts_base import get_tts_service
from app.services.tts import parse_script, Dialogue


def main():
    # 配置
    script_path = "data/output/2026-02-05/talks_sample.txt"
    output_path = "data/output/2026-02-05/test_output_11lab.mp3"

    print("=" * 60)
    print("ElevenLabs TTS 测试")
    print("=" * 60)

    # 读取逐字稿
    with open(script_path, "r", encoding="utf-8") as f:
        script = f.read()

    print(f"读取逐字稿: {script_path}")
    print(f"内容长度: {len(script)} 字")

    # 解析对话
    dialogues = parse_script(script)
    print(f"解析到 {len(dialogues)} 段对话")

    # 统计
    luo_count = sum(1 for d in dialogues if d.speaker == "luoyonghao")
    ziru_count = sum(1 for d in dialogues if d.speaker == "wangziru")
    print(f"罗永浩: {luo_count} 段")
    print(f"王自如: {ziru_count} 段")

    # 获取 ElevenLabs TTS 服务
    print("\n" + "=" * 60)
    print("正在生成音频...")
    print("=" * 60)

    tts = get_tts_service("elevenlabs")
    print(f"使用 TTS 服务: {type(tts).__name__}")

    # 只取前 3 段进行测试（避免消耗过多配额）
    test_dialogues = dialogues[:3]
    print(f"\n测试前 3 段对话:\n")

    # 生成每段音频
    output_dir = "data/output/2026-02-05/test_splits"
    os.makedirs(output_dir, exist_ok=True)

    audio_parts = []
    for i, d in enumerate(test_dialogues):
        print(f"[{i+1}/{len(test_dialogues)}] {d.speaker}: {d.text[:30]}...")

        speaker_name = "luoyonghao" if d.speaker == "luoyonghao" else "wangziru"
        output_file = os.path.join(output_dir, f"part_{i+1:03d}.mp3")

        try:
            tts.generate(d.text, speaker_name, output_file)
            audio_parts.append(output_file)
            print(f"  ✅ 已保存: {output_file}")
        except Exception as e:
            print(f"  ❌ 失败: {e}")

    # 合并音频
    if audio_parts:
        print("\n" + "=" * 60)
        print("合并音频...")
        print("=" * 60)

        from app.services.tts import MiniMaxTTSService
        merger = MiniMaxTTSService()
        merger.merge_audio(audio_parts, output_path)
        print(f"\n✅ 测试完成!")
        print(f"输出文件: {output_path}")
    else:
        print("\n❌ 没有生成音频片段")


if __name__ == "__main__":
    main()
