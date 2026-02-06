"""
TTS 可插拔架构测试
测试 MiniMax 和 ElevenLabs 的切换
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.services.tts_base import (
    get_tts_service,
    BaseTTSService,
    MiniMaxTTSService,
    ElevenLabsTTSService,
    TTS_PROVIDER
)


def test_provider_detection():
    """测试 provider 检测"""
    print("=" * 60)
    print("测试 1: Provider 检测")
    print("=" * 60)
    print(f"当前 TTS_PROVIDER: {TTS_PROVIDER}")


def test_factory():
    """测试工厂函数"""
    print("\n" + "=" * 60)
    print("测试 2: 工厂函数")
    print("=" * 60)

    # 测试 MiniMax
    tts_minimax = get_tts_service("minimax")
    print(f"MiniMax 服务类型: {type(tts_minimax).__name__}")
    assert isinstance(tts_minimax, MiniMaxTTSService)

    # 测试 ElevenLabs（未配置时会报错）
    try:
        tts_eleven = get_tts_service("elevenlabs")
        print(f"ElevenLabs 服务类型: {type(tts_eleven).__name__}")
        assert isinstance(tts_eleven, ElevenLabsTTSService)
    except ValueError as e:
        print(f"ElevenLabs 未配置（预期）: {e}")


def test_unified_interface():
    """测试统一接口"""
    print("\n" + "=" * 60)
    print("测试 3: 统一接口")
    print("=" * 60)

    # 使用当前配置的 provider
    tts = get_tts_service()
    print(f"使用的服务: {type(tts).__name__}")

    # 检查统一方法
    methods = ["generate", "batch_generate"]
    for method in methods:
        assert hasattr(tts, method), f"缺少方法: {method}"
        print(f"  ✓ {method}")


def test_voice_config():
    """测试音色配置"""
    print("\n" + "=" * 60)
    print("测试 4: 音色配置")
    print("=" * 60)

    # MiniMax
    print("MiniMax 音色:")
    for name, voice_id in MiniMaxTTSService.VOICE_IDS.items():
        print(f"  {name}: {voice_id}")

    # ElevenLabs
    print("\nElevenLabs 音色:")
    for name, voice_id in ElevenLabsTTSService.VOICE_IDS.items():
        voice_info = voice_id if voice_id else "未配置"
        print(f"  {name}: {voice_info}")


def test_switch_scenario():
    """测试切换场景"""
    print("\n" + "=" * 60)
    print("测试 5: 切换场景演示")
    print("=" * 60)

    print("""
【切换 TTS 服务的方法】

方法 1: 环境变量（推荐）
--------------------------------------
# .env 文件中设置：
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=xxx
ELEVENLABS_VOICE_LUO=voice_id_1
ELEVENLABS_VOICE_ZIRU=voice_id_2

方法 2: 代码中指定
--------------------------------------
from app.services.tts_base import get_tts_service

tts = get_tts_service("minimax")   # 使用 MiniMax
tts = get_tts_service("elevenlabs")  # 使用 ElevenLabs

方法 3: 流水线中指定
--------------------------------------
python app/podcast_pipeline.py --tts-provider elevenlabs
""")


def test_voice_listing():
    """测试音色列表（ElevenLabs）"""
    print("\n" + "=" * 60)
    print("测试 6: ElevenLabs 音色列表")
    print("=" * 60)

    if TTS_PROVIDER == "elevenlabs":
        tts = get_tts_service()
        try:
            voices = tts.list_voices()
            print(f"可用音色数量: {len(voices)}")
            for v in voices[:5]:
                print(f"  - {v.get('name', 'Unknown')}")
        except Exception as e:
            print(f"获取音色列表失败: {e}")
    else:
        print("当前使用 MiniMax，跳过 ElevenLabs 音色列表测试")
        print("如需测试 ElevenLabs，请设置 TTS_PROVIDER=elevenlabs")


def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("TTS 可插拔架构测试")
    print("=" * 60 + "\n")

    test_provider_detection()
    test_factory()
    test_unified_interface()
    test_voice_config()
    test_switch_scenario()
    test_voice_listing()

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
