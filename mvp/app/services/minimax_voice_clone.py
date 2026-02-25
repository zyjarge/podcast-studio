"""
MiniMax 语音克隆 CLI 工具

使用方法：
  python app/services/minimax_voice_clone.py clone --name "罗永浩" --file sample.mp3
  python app/services/minimax_voice_clone.py list
  python appvoice_clone.py delete/services/minimax_ <voice_id>

注意事项：
  - 音频样本需要清晰的中文语音
  - 建议时长：10秒 - 5分钟
  - 格式：mp3, m4a, wav
  - 大小：≤20MB
"""
import os
import sys
import json
import requests
from dotenv import load_dotenv

load_dotenv()

# 配置 (使用海外版 minimax.io)
API_KEY = os.getenv("MINIMAX_IO_API_KEY")
BASE_URL = "https://api.minimax.io/v1"
CONFIG_FILE = os.getenv("VOICE_CONFIG_FILE", "voices/minimax_voices.json")


def get_headers():
    """获取请求头"""
    return {"Authorization": f"Bearer {API_KEY}"}


def load_voices_config():
    """加载音色配置"""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_voices_config(config):
    """保存音色配置"""
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def upload_file(file_path: str, purpose: str = "voice_clone"):
    """上传音频文件"""
    url = f"{BASE_URL}/files/upload"

    with open(file_path, 'rb') as f:
        files = {"file": (os.path.basename(file_path), f)}
        data = {"purpose": purpose}

        response = requests.post(url, headers=get_headers(), files=files, data=data)
        response.raise_for_status()

    return response.json()["file"]["file_id"]


def clone_voice(name: str, file_id: str, voice_id: str = None):
    """克隆语音"""
    url = f"{BASE_URL}/voice_clone"

    payload = {
        "file_id": file_id,
        "voice_id": voice_id or name.lower().replace(" ", "_"),
        "text": "这是一个语音克隆测试",
        "model": "speech-2.8-hd"
    }

    response = requests.post(url, headers=get_headers(), json=payload)
    response.raise_for_status()

    return response.json()


def list_voices():
    """列出已克隆的音色（从本地配置）"""
    config = load_voices_config()

    if not config:
        print("\n暂无已克隆的音色")
        print(f"配置文件: {CONFIG_FILE}")
        return []

    print(f"\n已克隆的音色 (共 {len(config)} 个):\n")
    for name, voice_id in config.items():
        print(f"  名称: {name}")
        print(f"  Voice ID: {voice_id}")
        print()

    return config


def delete_voice(voice_id: str):
    """删除音色（仅从本地配置删除）"""
    config = load_voices_config()

    # 查找对应的名称
    name_to_delete = None
    for name, vid in config.items():
        if vid == voice_id:
            name_to_delete = name
            break

    if name_to_delete:
        del config[name_to_delete]
        save_voices_config(config)
        print(f"✅ 已从配置中删除音色: {name} ({voice_id})")
    else:
        print(f"⚠️ 未找到 voice_id: {voice_id}")


def help():
    """打印帮助"""
    print("""
================================================================================
MiniMax 语音克隆工具
================================================================================

【克隆新音色】
  python app/services/minimax_voice_clone.py clone --name "罗永浩" --file audio.mp3

【克隆新音色（指定 voice_id）】
  python app/services/minimax_voice_clone.py clone --name "罗永浩" --file audio.mp3 --voice-id luo_yonghao

【列出已克隆的音色】
  python app/services/minimax_voice_clone.py list

【删除音色（从配置中）】
  python app/services/minimax_voice_clone.py delete <voice_id>

【音频样本要求】
  - 格式：mp3, m4a, wav
  - 时长：10秒 - 5分钟
  - 大小：≤20MB
  - 内容：清晰的中文语音
  - 无背景音乐/噪音

【克隆成功后】
  1. 复制 Voice ID
  2. 更新 .env 文件中的 MINIMAX_VOICE_LUO=xxx

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
    elif command == "clone":
        # 解析参数
        name = None
        file_path = None
        voice_id = None

        i = 2
        while i < len(sys.argv):
            arg = sys.argv[i]
            if arg == "--name" and i + 1 < len(sys.argv):
                name = sys.argv[i + 1]
                i += 2
            elif arg == "--file" and i + 1 < len(sys.argv):
                file_path = sys.argv[i + 1]
                i += 2
            elif arg == "--voice-id" and i + 1 < len(sys.argv):
                voice_id = sys.argv[i + 1]
                i += 2
            else:
                i += 1

        if not name or not file_path:
            print("错误: 需要指定 --name 和 --file")
            return

        if not os.path.exists(file_path):
            print(f"错误: 文件不存在: {file_path}")
            return

        # 执行克隆
        print(f"\n[1/2] 上传音频文件: {file_path}")
        file_id = upload_file(file_path)
        print(f"  → File ID: {file_id}")

        print(f"\n[2/2] 克隆音色: {name}")
        result = clone_voice(name, file_id, voice_id)
        generated_voice_id = result.get("voice_id") or voice_id or name.lower().replace(" ", "_")

        # 保存到配置
        config = load_voices_config()
        config[name] = generated_voice_id
        save_voices_config(config)

        print(f"\n✅ 克隆成功!")
        print(f"  Voice ID: {generated_voice_id}")
        print(f"  已保存至: {CONFIG_FILE}")
        print(f"\n请将以下配置添加到 .env 文件:")
        print(f"  MINIMAX_VOICE_{name.upper().replace(' ', '_')}_NAME={name}")
        print(f"  MINIMAX_VOICE_{name.upper().replace(' ', '_')}_ID={generated_voice_id}")

    elif command == "list":
        list_voices()

    elif command == "delete":
        if len(sys.argv) < 3:
            print("错误: 需要指定 voice_id")
            return
        delete_voice(sys.argv[2])

    else:
        help()


if __name__ == "__main__":
    main()
