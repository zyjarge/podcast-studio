#!/bin/bash

# Podcast Studio 停止脚本
#
# Three independent kill paths run in order, each sufficient on its
# own. The pidfile is one input; the LISTEN sockets are another; the
# command-line signatures are a third. The motivation is the case we
# just hit: a backend started by `nohup .venv/bin/python -m uvicorn`
# outside of start.sh leaves no pidfile but does leave 8002 bound, so
# the user runs stop.sh and sees "no pidfile, nothing to do" - while
# the port is still held.

PID_FILE="/tmp/podcast-studio.pid"
BACKEND_PORT="${PODCAST_BACKEND_PORT:-8002}"
FRONTEND_PORT="${PODCAST_FRONTEND_PORT:-3001}"

echo -e "\033[0;34m========================================\033[0m"
echo -e "\033[0;34m   🛑 停止 Podcast Studio 服务\033[0m"
echo -e "\033[0;34m========================================\033[0m"
echo ""

# Disable job control warnings in non-interactive shells; pkill emits
# one when there's no match, which would otherwise abort `set -e`.
set +e

STOPPED=0

# ---------------------------------------------------------------------------
# Path 1: pidfile. Trust it when present, but never depend on it alone.
# ---------------------------------------------------------------------------
if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
        [ -z "$pid" ] && continue
        if [ "$pid" -gt 0 ] 2>/dev/null && kill -0 "$pid" 2>/dev/null; then
            PGID=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')
            if [ -n "$PGID" ] && [ "$PGID" -gt 0 ] 2>/dev/null; then
                pgrep -g "$PGID" 2>/dev/null | xargs -r kill 2>/dev/null
            fi
            kill "$pid" 2>/dev/null
            echo "  [pidfile]  stopped pid $pid (group $PGID)"
            STOPPED=$((STOPPED + 1))
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
else
    echo "  [pidfile]  none at $PID_FILE (process may have been started outside start.sh)"
fi

# ---------------------------------------------------------------------------
# Path 2: LISTEN socket. For each known port, find whatever process
# holds it and kill the entire process group. Catches the nohup /
# detached case the pidfile cannot.
# ---------------------------------------------------------------------------
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    # lsof prints "<pid> <cmd>" on each line for matching inodes. The
    # -t flag is "terse" = pids only. We use a 2-second timeout so
    # a slow lsof never blocks stop.sh past its own boot.
    PIDS_ON_PORT=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ')
    if [ -n "$PIDS_ON_PORT" ]; then
        for pid in $PIDS_ON_PORT; do
            # Skip our own shell and any pid we already killed above.
            if [ "$pid" = "$$" ] || [ "$pid" = "$PPID" ]; then
                continue
            fi
            if ! kill -0 "$pid" 2>/dev/null; then
                continue
            fi
            PGID=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')
            if [ -n "$PGID" ] && [ "$PGID" -gt 0 ] 2>/dev/null; then
                pgrep -g "$PGID" 2>/dev/null | xargs -r kill 2>/dev/null
            fi
            kill "$pid" 2>/dev/null
            echo "  [port $port]  stopped pid $pid (group $PGID)"
            STOPPED=$((STOPPED + 1))
        done
    fi
done

# ---------------------------------------------------------------------------
# Path 3: command-line fingerprint. The two regexes are project-
# specific - the backend is identified by 'app.main:app' (the
# import string FastAPI's uvicorn entry point uses) and the frontend
# by the path to its node_modules/.bin/vite. Catches reloader
# children that aren't on the LISTEN port yet (e.g. spawned but not
# bound). Anchored to the project tree so an unrelated vite/uvicorn
# running on this host is never touched.
# ---------------------------------------------------------------------------
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
pkill -f "app\.main:app" 2>/dev/null
pkill -f "${PROJECT_ROOT}/frontend/node_modules/.bin/vite" 2>/dev/null
# Don't claim credit for any kills here - pkill exits non-zero
# whenever its pattern matched zero processes, and we only want
# the message to reflect the verified ports/pidfile kills above.
set -e

# ---------------------------------------------------------------------------
# Final check: if the LISTEN sockets are still held, sleep briefly
# and re-probe. uvicorn may take a moment to release after SIGTERM.
# ---------------------------------------------------------------------------
REMAINING=""
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | grep -q .; then
        REMAINING="$REMAINING $port"
    fi
done
if [ -n "$REMAINING" ]; then
    sleep 1
fi

# Remove only the logfiles start.sh writes to. Leave anything the user
# wrote to /tmp alone (we never rm /tmp/*).
rm -f /tmp/podcast-backend.log /tmp/podcast-frontend.log

if [ "$STOPPED" -gt 0 ]; then
    echo ""
    echo -e "\033[0;32m✅ 已停止 ${STOPPED} 个服务进程\033[0m"
else
    echo ""
    echo -e "\033[0;32m✅ 没有需要停止的进程\033[0m"
fi
echo ""
