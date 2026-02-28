#!/bin/bash

# Podcast Studio 停止脚本

echo -e "\033[0;34m========================================\033[0m"
echo -e "\033[0;34m   🛑 停止 Podcast Studio 服务\033[0m"
echo -e "\033[0;34m========================================\033[0m"
echo ""

# 停止所有相关进程
pkill -f 'uvicorn.*app.main:app' 2>/dev/null
pkill -f 'vite' 2>/dev/null

# 清理 PID 文件
rm -f /tmp/podcast-studio.pid
rm -f /tmp/podcast-backend.log
rm -f /tmp/podcast-frontend.log

echo -e "\033[0;32m✅ 所有服务已停止\033[0m"
echo ""
