#!/bin/bash

# Podcast Studio 一键启动脚本

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🎙️  Podcast Studio 启动脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查后端虚拟环境
if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo -e "${YELLOW}⚠️  未找到后端虚拟环境，正在创建...${NC}"
    python3 -m venv "$BACKEND_DIR/.venv"
    source "$BACKEND_DIR/.venv/bin/activate"
    pip install -q -r "$BACKEND_DIR/requirements.txt"
    echo -e "${GREEN}✅ 虚拟环境创建完成${NC}"
else
    echo -e "${GREEN}✅ 后端虚拟环境已存在${NC}"
fi

# 启动后端
echo ""
echo -e "${YELLOW}📦 启动后端服务...${NC}"

# 先确认端口可用;被占用时询问用户(非交互模式自动用建议端口)
BACKEND_PORT="${PODCAST_BACKEND_PORT:-8002}"
BACKEND_PORT="$("$SCRIPTS_DIR/port_check.sh" "$BACKEND_PORT" "后端" 127.0.0.1)" || {
    echo -e "${RED}✗ 无法为后端分配端口,启动中止${NC}"
    exit 1
}
export PODCAST_BACKEND_PORT="$BACKEND_PORT"

# 后台启动后端
source "$BACKEND_DIR/.venv/bin/activate"
cd "$BACKEND_DIR"
uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload > /tmp/podcast-backend.log 2>&1 &
BACKEND_PID=$!

echo -e "${GREEN}✅ 后端已启动 (PID: $BACKEND_PID)${NC}"
echo -e "${BLUE}   后端地址: http://localhost:${BACKEND_PORT}${NC}"

# 等待后端启动
sleep 3

# 检查前端依赖
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  未找到前端依赖，正在安装...${NC}"
    cd "$FRONTEND_DIR"
    npm install
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
fi

# 启动前端
echo ""
echo -e "${YELLOW}🎨 启动前端服务...${NC}"
cd "$FRONTEND_DIR"

# 前端端口协商(同样的策略)
FRONTEND_PORT="${PODCAST_FRONTEND_PORT:-3001}"
FRONTEND_PORT="$("$SCRIPTS_DIR/port_check.sh" "$FRONTEND_PORT" "前端" 127.0.0.1)" || {
    echo -e "${RED}✗ 无法为前端分配端口,启动中止${NC}"
    kill "$BACKEND_PID" 2>/dev/null
    exit 1
}
export PODCAST_FRONTEND_PORT="$FRONTEND_PORT"

# 前端使用 npm run dev 启动;PODCAST_BACKEND_PORT 通过 vite 的 env 读,
# 让 vite.config.js 自动决定 server.port 和 proxy target。
npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" > /tmp/podcast-frontend.log 2>&1 &
FRONTEND_PID=$!

echo -e "${GREEN}✅ 前端已启动 (PID: $FRONTEND_PID)${NC}"
echo -e "${BLUE}   前端地址: http://localhost:${FRONTEND_PORT}${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🎙️  Podcast Studio 启动完成!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "服务地址:"
echo -e "  • 前端: ${GREEN}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  • 后端: ${GREEN}http://localhost:${BACKEND_PORT}${NC}"
echo -e "  • API文档: ${GREEN}http://localhost:${BACKEND_PORT}/docs${NC}"
echo ""
echo -e "日志文件:"
echo -e "  • 后端: /tmp/podcast-backend.log${NC}"
echo -e "  • 前端: /tmp/podcast-frontend.log${NC}"
echo ""
echo -e "停止服务: ${YELLOW}pkill -f 'uvicorn\\|vite'${NC}"
echo ""

# 保存 PID 到文件
echo "$BACKEND_PID" > /tmp/podcast-studio.pid
echo "$FRONTEND_PID" >> /tmp/podcast-studio.pid
