#!/usr/bin/env bash
# Single responsibility: figure out a free TCP port to bind.
# Used by start.sh to negotiate backend and frontend ports when the
# defaults are already taken.

set -u

DEFAULT_PORT="${1:-}"
SERVICE_NAME="${2:-service}"
HOST="${3:-127.0.0.1}"

if [ -z "$DEFAULT_PORT" ]; then
    echo "usage: $0 <default-port> [service-name] [bind-host]" >&2
    exit 2
fi

# --- helpers ---------------------------------------------------------------

# Test if `host:port` answers TCP without requiring a specific protocol.
# `bash`'s /dev/tcp is the cheapest cross-platform probe and exits 0 on
# connect, non-zero on connect-refused or unreachable.
is_port_in_use() {
    local port="$1"
    if command -v ss >/dev/null 2>&1; then
        # -ltnl: listening TCP, numeric port, no service resolution.
        # Match either 0.0.0.0:<port> or 127.0.0.1:<port> so we still catch
        # servers bound to all interfaces on this machine.
        if ss -ltn 2>/dev/null | awk '{print $4}' | grep -E "(127\.0\.0\.1|0\.0\.0\.0|\[::\]|\[::1\]):${port}\$" >/dev/null; then
            return 0
        fi
        return 1
    fi
    # Fallback: bash /dev/tcp probe.
    if (echo >"/dev/tcp/${HOST}/${port}") >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Print the PID of whoever is holding the port, if any. Best-effort.
# Empty means "could not tell".
port_holder() {
    local port="$1"
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | head -n1
    elif command -v fuser >/dev/null 2>&1; then
        # fuser prints PIDs to stdout; silenced for parseability.
        fuser -n tcp "${port}" 2>/dev/null | tr -s ' \n' ' ' | sed 's/ $//'
    fi
}

# Pick the lowest free port in [$start, $start+50). Skips ports still in use.
suggest_port() {
    local start="$1"
    local candidate
    for ((candidate = start; candidate < start + 50; candidate++)); do
        if ! is_port_in_use "$candidate"; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

# Prompt the user once with a default suggestion. Returns the chosen port.
# - In an interactive TTY: prompt, accept empty input as default, reject
#   invalid non-numeric input, accept whichever free port the user types.
# - In a non-interactive environment (CI, systemd, ssh non-allocating pty):
#   skip the prompt, accept the suggested port directly.
prompt_for_port() {
    local default_suggestion="$1"
    # If stdin is not a TTY, just take the suggestion. This is the
    # behaviour systemd / cron / `make start` users expect: it boots.
    if [ ! -t 0 ]; then
        echo "$default_suggestion"
        return 0
    fi

    while :; do
        printf "请输入 %s 的新端口 [默认 %s, 直接回车即采用]: " \
            "$SERVICE_NAME" "$default_suggestion"
        if ! read -r user_port; then
            # read failed (Ctrl-D / no parent TTY): fall back to suggestion.
            printf "\n"
            echo "$default_suggestion"
            return 0
        fi
        if [ -z "$user_port" ]; then
            echo "$default_suggestion"
            return 0
        fi
        if ! [[ "$user_port" =~ ^[0-9]+$ ]] \
            || [ "$user_port" -lt 1 ] || [ "$user_port" -gt 65535 ]; then
            printf "端口必须是 1-65535 之间的数字,再试一次。\n"
            continue
        fi
        if is_port_in_use "$user_port"; then
            local holder
            holder=$(port_holder "$user_port")
            if [ -n "$holder" ]; then
                printf "端口 %s 也被占用了(PID %s),再换一个。\n" \
                    "$user_port" "$holder"
            else
                printf "端口 %s 也被占用了,再换一个。\n" "$user_port"
            fi
            continue
        fi
        echo "$user_port"
        return 0
    done
}

# --- main ------------------------------------------------------------------

# Stash the proposed default so the caller can decide whether to ask.
# Output (stdout):
#   <chosen_port>
# Exit 0 always (we always pick something).

DEFAULT_IS_FREE=0
if is_port_in_use "$DEFAULT_PORT"; then
    DEFAULT_IS_FREE=1
fi
if [ "$DEFAULT_IS_FREE" -eq 0 ]; then
    echo "$DEFAULT_PORT"
    exit 0
fi

holder=$(port_holder "$DEFAULT_PORT")
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'
if [ -n "$holder" ]; then
    printf "%s⚠️  %s 默认端口 %s 已被占用 (PID %s)%s\n" \
        "$RED" "$SERVICE_NAME" "$DEFAULT_PORT" "$holder" "$NC" >&2
else
    printf "%s⚠️  %s 默认端口 %s 已被占用%s\n" \
        "$RED" "$SERVICE_NAME" "$DEFAULT_PORT" "$NC" >&2
fi

suggested=$(suggest_port "$((DEFAULT_PORT + 1))") || {
    printf "%s✗ 在 %s+%s 区间内找不到空闲端口%s\n" \
        "$RED" "$DEFAULT_PORT" 50 "$NC" >&2
    exit 1
}

printf "%s建议端口:%s %s\n" "$YELLOW" "$NC" "$suggested" >&2

prompt_for_port "$suggested"
