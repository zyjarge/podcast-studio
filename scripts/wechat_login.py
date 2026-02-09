#!/usr/bin/env python3
"""
使用 Playwright storage_state 保存/恢复登录状态
"""
import os
import json
from playwright.sync_api import sync_playwright

# 路径配置
CHROME_PROFILE = "/Users/zhangyong/Library/Application Support/Google/Chrome/Default"
STATE_FILE = "data/chrome_state.json"


def save_state():
    """手动登录后保存状态"""
    with sync_playwright() as p:
        # 使用现有 Chrome 配置
        context = p.chromium.launch_persistent_context(
            CHROME_PROFILE,
            headless=False,
            locale="zh-CN",
        )
        page = context.new_page()

        page.goto("https://mp.weixin.qq.com")
        print("请手动登录... 登录成功后按 Enter")
        input()

        # 保存状态（包含 cookies + localStorage）
        context.storage_state(path=STATE_FILE)
        print(f"✅ 状态已保存到: {STATE_FILE}")

        context.close()


def restore_and_open():
    """恢复状态并打开"""
    if not os.path.exists(STATE_FILE):
        print(f"⚠️  未找到状态文件: {STATE_FILE}")
        print("请先运行: python scripts/wechat_login.py --save")
        return

    with sync_playwright() as p:
        # 恢复状态
        context = p.chromium.launch_persistent_context(
            CHROME_PROFILE,
            headless=False,
            locale="zh-CN",
            storage_state=STATE_FILE,
        )
        page = context.new_page()

        page.goto("https://mp.weixin.qq.com")
        print("已打开公众号（使用保存的登录状态）")

        # 保持打开
        import time
        time.sleep(300)

        context.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--save":
        save_state()
    else:
        restore_and_open()
