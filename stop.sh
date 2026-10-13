#!/bin/bash

# Podcast Studio 停止脚本
#
# Kill the processes that start.sh wrote to /tmp/podcast-studio.pid
# rather than `pkill -f uvicorn|vite`, which would terminate every
# podcast-studio backend on the host (and any unrelated vite dev
# server the developer is running).

PID_FILE="/tmp/podcast-studio.pid"

echo -e "\033[0;34m========================================\033[0m"
echo -e "\033[0;34m   🛑 停止 Podcast Studio 服务\033[0m"
echo -e "\033[0;34m========================================\033[0m"
echo ""

STOPPED=0
if [ -f "$PID_FILE" ]; then
    # Read each non-empty line as a pid. We kill the pid's process
    # group first so that descendants of npm / uvicorn-reloader do
    # not outlive their recorded parent. Then we kill the recorded
    # pid itself as a fallback.
    #
    # Why process groups: `npm run dev` is a 3-level tree
    #   npm -> sh -c 'vite ...' -> node ... vite
    # and pkill -P on the npm pid only kills the sh; the node stays
    # alive orphaned. setpgid'd process trees are killed cleanly by
    # `kill -- -PGID`. If the process was never put in its own
    # group, we fall back to the pid + direct children approach.
    while IFS= read -r pid; do
        [ -z "$pid" ] && continue
        if [ "$pid" -gt 0 ] 2>/dev/null && kill -0 "$pid" 2>/dev/null; then
            PGID=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')
            # Only signal the negative pgid if it's distinct from any
            # other service we are tracking - otherwise we'd torch a
            # sibling. Always also kill -P as a fallback.
            if [ -n "$PGID" ] && [ "$PGID" -gt 0 ] 2>/dev/null; then
                PIDS_OF_PGID=$(pgrep -g "$PGID" 2>/dev/null | tr '\n' ' ')
                # Don't kill our own pid if it's the only one in the pg
                # and shares it with the shell that's running this.
                if [ -n "$PIDS_OF_PGID" ]; then
                    kill $PIDS_OF_PGID 2>/dev/null
                fi
            fi
            kill "$pid" 2>/dev/null
            echo "  stopped pid $pid (group $PGID)"
            STOPPED=$((STOPPED + 1))
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
else
    echo "  no pidfile at $PID_FILE (never started via start.sh, or already cleaned up)"
fi

# Remove only the logfiles start.sh writes to. Leave anything the user
# wrote to /tmp alone (we never rm /tmp/*).
rm -f /tmp/podcast-backend.log /tmp/podcast-frontend.log

if [ "$STOPPED" -gt 0 ]; then
    echo -e "\033[0;32m✅ 已停止 ${STOPPED} 个服务进程(PID 记录已清除)\033[0m"
else
    echo -e "\033[0;32m✅ 没有需要停止的进程(pidfile 不存在或为空)\033[0m"
fi
echo ""
