#!/usr/bin/env python3
"""
步骤1：先手动登录插件
步骤2：运行此脚本保存插件状态
"""
import os
import shutil
from pathlib import Path

# Chrome 配置文件路径
CHROME_PROFILE = "/Users/zhangyong/Library/Application Support/Google/Chrome/Default"

# 要保存的插件 ID
EXTENSION_ID = "ibefaeehajgcpooopoegkifhgecigeeg"

# 插件本地存储路径
SOURCE_PLUGIN_STATE = os.path.join(
    CHROME_PROFILE,
    "Local Extension Settings",
    EXTENSION_ID
)

# 保存路径
BACKUP_DIR = "data/plugin_state"
BACKUP_PATH = os.path.join(BACKUP_DIR, EXTENSION_ID)


def save_plugin_state():
    """保存插件状态"""
    if not os.path.exists(SOURCE_PLUGIN_STATE):
        print(f"❌ 插件状态不存在: {SOURCE_PLUGIN_STATE}")
        print("请先在普通 Chrome 中打开插件并登录")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)

    # 删除旧的备份
    if os.path.exists(BACKUP_PATH):
        shutil.rmtree(BACKUP_PATH)

    # 复制插件状态
    shutil.copytree(SOURCE_PLUGIN_STATE, BACKUP_PATH)

    print(f"✅ 插件状态已保存到: {BACKUP_PATH}")
    print(f"   文件数: {len(os.listdir(BACKUP_PATH))}")


if __name__ == "__main__":
    save_plugin_state()
