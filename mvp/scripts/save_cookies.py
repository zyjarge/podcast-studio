#!/usr/bin/env python3
"""
保存 Chrome 的登录状态（cookies + 插件状态）
"""
import os
import shutil
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


def save_state():
    os.makedirs(BACKUP_DIR, exist_ok=True)

    with sync_playwright() as p:
        # 加载 Chrome 配置
        context = p.chromium.launch_persistent_context(
            CHROME_PROFILE,
            headless=True,  # 无头模式，不需要显示
            locale="zh-CN",
        )

        # 保存 cookies
        cookies = context.cookies()
        import json
        with open(COOKIES_FILE, "w") as f:
            json.dump(cookies, f, indent=2)
        print(f"✅ 已保存 {len(cookies)} 个 cookies 到: {COOKIES_FILE}")

        # 打印公众号相关的 cookies
        wx_cookies = [c for c in cookies if "weixin.qq.com" in c.get("domain", "")]
        print(f"   公众号相关 cookies: {len(wx_cookies)} 个")

        context.close()

    # 备份插件状态
    source_plugin_dir = os.path.join(CHROME_PROFILE, "Local Extension Settings", EXTENSION_ID)
    if os.path.exists(source_plugin_dir):
        dest_plugin_dir = PLUGIN_STATE_DIR
        if os.path.exists(dest_plugin_dir):
            shutil.rmtree(dest_plugin_dir)
        os.makedirs(os.path.dirname(dest_plugin_dir), exist_ok=True)
        shutil.copytree(source_plugin_dir, dest_plugin_dir)
        print(f"✅ 插件状态已备份")
    else:
        print(f"⚠️  未找到插件状态")

    print(f"\n📁 备份位置: {BACKUP_DIR}")
    print("\n下次启动时，脚本会自动恢复这些状态")


if __name__ == "__main__":
    save_state()
