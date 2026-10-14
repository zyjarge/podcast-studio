#!/bin/bash

# Podcast Studio 一键启动脚本

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# Where startup bookkeeping lives. /tmp means we don't carry stale
# state across reboots; pidfile drives `stop.sh` precisely instead of
# relying on pattern matches.
PID_FILE="/tmp/podcast-studio.pid"

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

# --- backend virtualenv --------------------------------------------------
# Always work inside backend/.venv/bin/python explicitly. Calling
# `uvicorn` from PATH resolved the project to whatever's first
# on PATH (often a host-installed hermes-agent venv) and the worker
# subprocess then crashed with ModuleNotFoundError on first import.
# The earlier `source .venv/bin/activate` doesn't help: it sets
# shell variables but doesn't override a bare command lookup.
if [ ! -d "$BACKEND_DIR/.venv/bin" ]; then
    echo -e "${YELLOW}⚠️  未找到后端虚拟环境，正在创建...${NC}"
    python3 -m venv "$BACKEND_DIR/.venv"
    "$BACKEND_DIR/.venv/bin/python" -m ensurepip 2>/dev/null || true
    "$BACKEND_DIR/.venv/bin/python" -m pip install -q -r "$BACKEND_DIR/requirements.txt"
    echo -e "${GREEN}✅ 虚拟环境创建完成${NC}"
else
    echo -e "${GREEN}✅ 后端虚拟环境已存在${NC}"
fi
BACKEND_PYTHON="$BACKEND_DIR/.venv/bin/python"

# --- backend port negotiation --------------------------------------------
echo ""
echo -e "${YELLOW}📦 启动后端服务...${NC}"

# 先确认端口可用;被占用时询问用户(非交互模式自动用建议端口)
BACKEND_PORT="${PODCAST_BACKEND_PORT:-8002}"
BACKEND_PORT="$("$SCRIPTS_DIR/port_check.sh" "$BACKEND_PORT" "后端" 127.0.0.1)" || {
    echo -e "${RED}✗ 无法为后端分配端口,启动中止${NC}"
    exit 1
}
export PODCAST_BACKEND_PORT="$BACKEND_PORT"

# --- start backend ------------------------------------------------------
# Use the explicit venv python so the worker's import path matches
# the dependency install we just did. Pass --app-label so an external
# process tree (or future `stop.sh`) can find this exact uvicorn
# without ambiguity.
cd "$BACKEND_DIR"
PODCAST_BACKEND_PORT="$BACKEND_PORT" "$BACKEND_PYTHON" \
    -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "$BACKEND_PORT" \
    --reload \
    > /tmp/podcast-backend.log 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"

echo -e "${GREEN}✅ 后端已启动 (PID: $BACKEND_PID)${NC}"
echo -e "${BLUE}   后端地址: http://localhost:${BACKEND_PORT}${NC}"

# --- backend readiness probe --------------------------------------------
# Wait for /health to return 200 instead of guessing with `sleep 3`.
# Polls every 0.5s up to 15s, then fails loudly so we don't print
# "✅ 已启动" and walk away from a crashed worker.
HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/health"
ATTEMPTS=30   # 30 * 0.5s = 15s
HEALTHY=0
while [ "$ATTEMPTS" -gt 0 ]; do
    if curl -sf -o /dev/null --max-time 1 "$HEALTH_URL"; then
        HEALTHY=1
        break
    fi
    # If the worker died, stop polling and report
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        break
    fi
    sleep 0.5
    ATTEMPTS=$((ATTEMPTS - 1))
done

if [ "$HEALTHY" -ne 1 ]; then
    echo -e "${RED}✗ 后端在 15 秒内无法响应 /health${NC}"
    echo -e "${YELLOW}   后端 PID $BACKEND_PID 是否仍在? $(kill -0 $BACKEND_PID 2>/dev/null && echo alive || echo dead)${NC}"
    echo -e "${YELLOW}   最近的 backend 日志:${NC}"
    tail -n 30 /tmp/podcast-backend.log | sed 's/^/   /'
    kill "$BACKEND_PID" 2>/dev/null
    rm -f "$PID_FILE"
    exit 1
fi

# --- frontend deps ------------------------------------------------------
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  未找到前端依赖，正在安装...${NC}"
    cd "$FRONTEND_DIR"
    npm install
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
fi

# --- frontend port negotiation -----------------------------------------
echo ""
echo -e "${YELLOW}🎨 启动前端服务...${NC}"
cd "$FRONTEND_DIR"

FRONTEND_PORT="${PODCAST_FRONTEND_PORT:-3001}"
FRONTEND_PORT="$("$SCRIPTS_DIR/port_check.sh" "$FRONTEND_PORT" "前端" 127.0.0.1)" || {
    echo -e "${RED}✗ 无法为前端分配端口,启动中止${NC}"
    kill "$BACKEND_PID" 2>/dev/null
    rm -f "$PID_FILE"
    exit 1
}
export PODCAST_FRONTEND_PORT="$FRONTEND_PORT"

# Vite reads PODCAST_BACKEND_PORT to align its proxy target.
npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" > /tmp/podcast-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "$BACKEND_PID"$'\n'"$FRONTEND_PID" > "$PID_FILE"

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
echo -e "停止服务: ${YELLOW}./stop.sh${NC}"
echo ""
