#!/usr/bin/env python3
"""
启动 Chrome，恢复已保存的登录状态
"""
import os
import shutil
import json
from playwright.sync_api import sync_playwright

# Chrome 配置文件路径
CHROME_PROFILE = "/Users/zhangyong/Library/Application Support/Google/Chrome/Default"

# 插件 ID
EXTENSION_ID = "ibefaeehajgcpooopoegkifhgecigeeg"
EXTENSION_VERSION = "12.0.8_0"

# 备份目录
BACKUP_DIR = "data/chrome_backup"
COOKIES_FILE = os.path.join(BACKUP_DIR, "cookies.json")
PLUGIN_STATE_DIR = os.path.join(BACKUP_DIR, "extension_settings", EXTENSION_ID)
PLUGIN_STATE_TARGET = os.path.join(CHROME_PROFILE, "Local Extension Settings", EXTENSION_ID)


def restore_state():
    """恢复保存的状态"""
    restored = False

    # 恢复插件状态
    if os.path.exists(PLUGIN_STATE_DIR):
        # 备份当前状态
        if os.path.exists(PLUGIN_STATE_TARGET):
            shutil.move(PLUGIN_STATE_TARGET, PLUGIN_STATE_TARGET + "_bak")
        os.makedirs(os.path.dirname(PLUGIN_STATE_TARGET), exist_ok=True)
        shutil.copytree(PLUGIN_STATE_DIR, PLUGIN_STATE_TARGET)
        print(f"✅ 插件状态已恢复")
        restored = True
    else:
        print(f"⚠️  未找到插件状态备份")

    # 恢复 cookies（启动后注入）
    return restored


def main():
    # 先恢复插件状态
    restore_state()

    with sync_playwright() as p:
        # 启动浏览器
        context = p.chromium.launch_persistent_context(
            CHROME_PROFILE,
            headless=False,
            locale="zh-CN",
        )

        # 尝试恢复 cookies
        if os.path.exists(COOKIES_FILE):
            with open(COOKIES_FILE, "r") as f:
                cookies = json.load(f)
            context.add_cookies(cookies)
            print(f"✅ 已恢复 {len(cookies)} 个 cookies")
        else:
            print(f"⚠️  未找到 cookies 备份")

        # 打开微信公众号后台
        page = context.new_page()
        page.goto("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=928896058#tab=sent-panel")
        print(f"\n已打开微信公众号后台")

        # 检查登录状态
        current_cookies = context.cookies()
        wx_cookies = [c for c in current_cookies if "weixin.qq.com" in c.get("domain", "")]
        print(f"当前公众号 cookies: {len(wx_cookies)} 个")

        # 保持浏览器打开
        print("\n按 Ctrl+C 退出")
        try:
            page.wait_for_timeout(300000)
        except KeyboardInterrupt:
            print("\n已退出")

        context.close()


if __name__ == "__main__":
    main()
