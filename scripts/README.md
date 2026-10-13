# 启动脚本说明 — start.sh / stop.sh / scripts/port_check.sh

## 端口协商

`start.sh` 在拉起后端 (uvicorn) 和前端 (vite) 之前都会调用
`scripts/port_check.sh`,检测默认端口是否被占用:

| 情况 | 行为 |
|------|------|
| 默认端口空闲 | 静默使用 |
| 默认端口被占用 | 在 stderr 给出红色警告(包含占用者 PID),并自动选下一个空闲端口 |
| 终端交互(TTY) | 提示输入新端口;空回车用建议值,被占用的输入会再次报错 |
| 非交互(SSH 无 tty、systemd、CI、`make start` 等) | 跳过提示,直接用建议端口 |

后端默认端口是 `8002`,前端默认是 `3001`。两者都可通过
环境变量覆盖:

```bash
PODCAST_BACKEND_PORT=9001 PODCAST_FRONTEND_PORT=4001 ./start.sh
```

`vite.config.js` 通过 `PODCAST_BACKEND_PORT` / `PODCAST_FRONTEND_PORT`
自动决定 `server.port` 和 `proxy.*` 指向,前端 dev server 与后端实际
启动端口始终一致,修复了 [#16](https://github.com/zyjarge/podcast-studio/issues/16)。

## 手动复用

```bash
# 看默认端口是否被占用
./scripts/port_check.sh 8002 backend

# 强制非交互(适合 CI)
./scripts/port_check.sh 8002 backend < /dev/null
```

## 退出码

| Code | 含义 |
|------|------|
| 0    | 成功(stdout 为选中端口) |
| 1    | 找不到空闲端口 |
| 2    | 调用方参数错误 |

## 停止

```bash
./stop.sh
# 同义(粗暴但彻底):
pkill -f 'uvicorn.*app.main:app'
pkill -f 'vite'
```
