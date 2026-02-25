#!/usr/bin/env python3
"""
MiniMax.io TTS 自动化脚本 (基于浏览器 Cookie)
使用浏览器会话认证来生成 TTS 音频
"""

import os
import sys
import json
import time
import requests
from pathlib import Path
from datetime import datetime

# 添加项目根目录
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()


class MiniMaxBrowserTTS:
    """基于浏览器 Cookie 的 MiniMax TTS"""

    # MiniMax API 基础 URL
    BASE_URL = "https://www.minimax.io/v1/api"

    # 设备参数 (从浏览器获取)
    DEVICE_PARAMS = {
        "device_platform": "web",
        "app_id": "3001",
        "version_code": "22201",
        "biz_id": "1",
        "uuid": "1b1a172b-521d-4b59-862f-eced15797950",
        "lang": "en",
        "device_id": "476044106211901442",
        "os_name": "Mac",
        "browser_name": "chrome",
        "device_memory": "8",
        "cpu_core_num": "4",
        "browser_language": "zh-CN",
        "browser_platform": "MacIntel",
        "screen_width": "1680",
        "screen_height": "1050",
    }

    def __init__(self, cookie: str = None):
        """初始化 TTS 客户端"""
        self.cookie = cookie or os.getenv("MINIMAX_BROWSER_COOKIE")
        if not self.cookie:
            raise ValueError("需要提供 Cookie (MINIMAX_BROWSER_COOKIE)")

        # 解析 Cookie 字符串
        self.cookies_dict = self._parse_cookie(cookie)

        # 会话
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://www.minimax.io/audio/text-to-speech",
        })
        self.session.cookies.update(self.cookies_dict)

    def _parse_cookie(self, cookie_str: str) -> dict:
        """解析 Cookie 字符串"""
        cookies = {}
        for item in cookie_str.split(";"):
            item = item.strip()
            if "=" in item:
                key, value = item.split("=", 1)
                cookies[key.strip()] = value.strip()
        return cookies

    def _get_unix_timestamp(self) -> int:
        """获取当前 Unix 时间戳"""
        return int(datetime.now().timestamp() * 1000)

    def _build_url(self, endpoint: str) -> str:
        """构建完整的 API URL"""
        params = {**self.DEVICE_PARAMS, "unix": self._get_unix_timestamp()}
        param_str = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{self.BASE_URL}{endpoint}?{param_str}"

    def _get_headers(self) -> dict:
        """获取请求头"""
        return {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://www.minimax.io/audio/text-to-speech",
            "Origin": "https://www.minimax.io",
        }

    def get_voice_list(self) -> list:
        """获取可用声音列表"""
        url = self._build_url("/audio/voice/list")
        resp = self.session.get(url, headers=self._get_headers())
        resp.raise_for_status()
        return resp.json()

    def get_voice_id(self, voice_name: str) -> str:
        """获取指定名称的声音 ID"""
        voice_list = self.get_voice_list()
        voices = voice_list.get("data", {}).get("voice_list", [])

        for voice in voices:
            if voice.get("voice_name") == voice_name:
                return voice.get("voice_id")

        # 尝试模糊匹配
        for voice in voices:
            if voice_name.lower() in voice.get("voice_name", "").lower():
                return voice.get("voice_id")

        raise ValueError(f"未找到声音: {voice_name}")

    def get_billing_info(self) -> dict:
        """获取账户余额信息"""
        url = self._build_url("/audio/billing/credit")
        params = {
            "scene": "1",
            "coin_type": "0",
            "biz_line": "1"
        }
        url = f"{url}&{'&'.join([f'{k}={v}' for k, v in params.items()])}"

        resp = self.session.get(url, headers=self._get_headers())
        resp.raise_for_status()
        return resp.json()

    def generate_audio(
        self,
        text: str,
        voice_id: str,
        model: str = "speech-2.8-hd",
        speed: float = 1.0,
        pitch: int = 0,
        volume: float = 1.0,
    ) -> str:
        """
        生成 TTS 音频

        注意：由于 API 端点未知，此方法使用浏览器自动化方式

        返回: 音频 URL
        """
        # 尝试可能的 TTS 端点
        endpoints = [
            "/audio/generate",
            "/audio/create",
            "/t2a/generate",
            "/t2a/create",
        ]

        for endpoint in endpoints:
            try:
                url = self._build_url(endpoint)

                payload = {
                    "text": text,
                    "voice_id": voice_id,
                    "model": model,
                    "speed": speed,
                    "pitch": pitch,
                    "volume": volume,
                    "language": "zh-CN",
                }

                resp = self.session.post(
                    url,
                    headers={
                        **self._get_headers(),
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=30
                )

                if resp.status_code == 200:
                    result = resp.json()
                    if result.get("statusInfo", {}).get("code") == 0:
                        return result

            except requests.exceptions.RequestException as e:
                print(f"端点 {endpoint} 失败: {e}")
                continue

        raise Exception("所有 TTS 端点均失败，请检查 Cookie 或网络连接")

    def wait_for_audio_completion(self, audio_id: str, max_wait: int = 120) -> dict:
        """等待音频生成完成"""
        start_time = time.time()

        while time.time() - start_time < max_wait:
            try:
                url = self._build_url(f"/audio/details")
                url = f"{url}&audio_id={audio_id}"

                resp = self.session.get(url, headers=self._get_headers())
                resp.raise_for_status()
                result = resp.json()

                if result.get("statusInfo", {}).get("code") == 0:
                    audio_info = result.get("data", {}).get("audio_info", {})
                    status = audio_info.get("status", -1)

                    if status == 0:  # 完成
                        return result
                    elif status == 1:  # 处理中
                        time.sleep(2)
                        continue
                    else:
                        raise Exception(f"音频状态异常: {status}")

            except Exception as e:
                print(f"查询状态失败: {e}")
                time.sleep(2)
                continue

        raise Exception("等待音频生成超时")

    def download_audio(self, audio_url: str, output_path: str) -> str:
        """下载音频文件"""
        resp = self.session.get(audio_url, stream=True)
        resp.raise_for_status()

        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        return output_path


def main():
    """测试 MiniMax Browser TTS"""
    import argparse

    parser = argparse.ArgumentParser(description="MiniMax TTS (基于浏览器 Cookie)")
    parser.add_argument("--text", default="大家好，我是罗永浩。", help="要转换的文本")
    parser.add_argument("--voice", default="luo", help="声音名称")
    parser.add_argument("--output", default="data/output/2026-02-05/browser_tts_output.mp3", help="输出文件路径")
    parser.add_argument("--cookie", help="浏览器 Cookie (也可以设置 MINIMAX_BROWSER_COOKIE 环境变量)")

    args = parser.parse_args()

    # 从参数或环境变量获取 Cookie
    cookie = args.cookie or os.getenv("MINIMAX_BROWSER_COOKIE")
    if not cookie:
        print("错误: 需要提供 Cookie")
        print("请在浏览器中打开 minimax.io, 登录后获取 Cookie")
        print("然后设置 MINIMAX_BROWSER_COOKIE 环境变量或使用 --cookie 参数")
        sys.exit(1)

    print("初始化 MiniMax TTS 客户端...")
    tts = MiniMaxBrowserTTS(cookie)

    print("\n获取账户信息...")
    try:
        billing = tts.get_billing_info()
        print(f"余额查询: {json.dumps(billing, ensure_ascii=False, indent=2)[:200]}...")
    except Exception as e:
        print(f"余额查询失败: {e}")

    print("\n获取声音列表...")
    try:
        voices = tts.get_voice_list()
        voice_list = voices.get("data", {}).get("voice_list", [])
        print(f"找到 {len(voice_list)} 个声音")

        # 打印前 5 个声音
        for voice in voice_list[:5]:
            print(f"  - {voice.get('voice_name')}: {voice.get('voice_id')}")
    except Exception as e:
        print(f"获取声音列表失败: {e}")

    print(f"\n尝试生成音频...")
    print(f"文本: {args.text}")
    print(f"声音: {args.voice}")

    try:
        result = tts.generate_audio(args.text, args.voice)
        print(f"生成结果: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}...")
    except Exception as e:
        print(f"生成失败: {e}")
        print("\n注意: 由于 MiniMax API 可能使用 WebSocket 或内部 API，")
        print("      直接 HTTP 请求可能无法工作。")
        print("      建议使用浏览器 MCP 工具进行自动化。")


if __name__ == "__main__":
    main()
