"""
ElevenLabs 音色克隆脚本

使用方法：
  python app/services/voice_clone.py clone --name "罗永浩" --files sample1.mp3 sample2.mp3

注意事项：
  - 音频样本需要清晰的中文语音
  - 建议时长：30秒 - 5分钟
  - 格式：MP3, WAV, OGG
  - 无背景音乐/噪音
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ELEVENLABS_API_KEY")
BASE_URL = "https://api.elevenlabs.io/v1"


def list_voices():
    """列出所有已创建的音色"""
    import requests

    url = f"{BASE_URL}/voices"
    headers = {"xi-api-key": API_KEY}

    resp = requests.get(url, headers=headers)
    resp.raise_for_status()

    data = resp.json()
    voices = data.get("voices", [])

    print(f"\n已创建 {len(voices)} 个音色:\n")
    for v in voices:
        print(f"  ID: {v['voice_id']}")
        print(f"  名称: {v.get('name', 'Unknown')}")
        print(f"  标签: {v.get('labels', {})}")
        print()


def clone_voice(name: str, files: list, description: str = ""):
    """
    克隆新音色 - 使用 REST API
    """
    import requests

    url = f"{BASE_URL}/voices/add"
    headers = {"xi-api-key": API_KEY}

    print(f"\n正在克隆音色: {name}")
    print(f"音频文件: {files}")

    # 准备文件上传
    file_handles = []
    for f in files:
        file_handles.append(
            ("files", (os.path.basename(f), open(f, "rb"), "audio/mpeg"))
        )

    # 准备表单数据
    data = {
        "name": name,
        "description": description,
        "labels": '{"accent": "chinese", "gender": "female"}',
    }

    try:
        resp = requests.post(url, files=file_handles, data=data, headers=headers)

        # 关闭文件句柄
        for _, fh in file_handles:
            fh[1].close()

        if resp.status_code == 200:
            result = resp.json()
            voice_id = result.get("voice_id")
            print(f"\n✅ 克隆成功!")
            print(f"Voice ID: {voice_id}")
            print(f"\n请将以下配置添加到 .env 文件:")
            name_key = name.upper().replace(" ", "_")
            print(f"\n  ELEVENLABS_VOICE_{name_key}_NAME={name}")
            print(f"  ELEVENLABS_VOICE_{name_key}_ID={voice_id}")
        else:
            print(f"\n❌ 克隆失败: {resp.status_code}")
            print(resp.text)

    except Exception as e:
        # 确保关闭文件
        for _, fh in file_handles:
            try:
                fh[1].close()
            except:
                pass
        raise


def delete_voice(voice_id: str):
    """删除音色"""
    import requests

    url = f"{BASE_URL}/voices/{voice_id}"
    headers = {"xi-api-key": API_KEY}

    resp = requests.delete(url, headers=headers)
    if resp.status_code == 200:
        print(f"✅ 已删除音色: {voice_id}")
    else:
        print(f"❌ 删除失败: {resp.status_code}")


def help():
    """打印帮助"""
    print("""
================================================================================
ElevenLabs 音色克隆工具
================================================================================

【查看已创建的音色】
  python app/services/voice_clone.py list

【克隆新音色】
  python app/services/voice_clone.py clone --name "罗永浩" --files audio1.mp3 audio2.mp3

【删除音色】
  python app/services/voice_clone.py delete <voice_id>

【音频样本要求】
  - 格式：MP3, WAV, OGG
  - 时长：30秒 - 5分钟
  - 内容：清晰的中文语音
  - 无背景音乐/噪音
  - 建议多段不同内容的音频

【克隆成功后】
  1. 复制 Voice ID
  2. 更新 .env 文件中的 ELEVENLABS_VOICE_LUO=xxx

================================================================================
""")


def main():
    """主函数"""
    if len(sys.argv) < 2:
        help()
        return

    command = sys.argv[1]

    if command in ["-h", "--help", "help"]:
        help()
    elif command == "list":
        list_voices()
    elif command == "clone":
        # 解析参数
        name = None
        files = []
        i = 2
        while i < len(sys.argv):
            arg = sys.argv[i]
            if arg == "--name" and i + 1 < len(sys.argv):
                name = sys.argv[i + 1]
                i += 2
            elif arg == "--files":
                i += 1
                while i < len(sys.argv) and not sys.argv[i].startswith("--"):
                    files.append(sys.argv[i])
                    i += 1
            else:
                i += 1

        if not name or not files:
            print("错误: 需要指定 --name 和 --files")
            return

        clone_voice(name, files)
    elif command == "delete":
        if len(sys.argv) < 3:
            print("错误: 需要指定 voice_id")
            return
        delete_voice(sys.argv[2])
    else:
        help()


if __name__ == "__main__":
    main()
