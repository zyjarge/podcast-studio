#!/bin/bash

# ============================================
# 播客生成一键脚本
# ============================================

# 设置路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 激活虚拟环境
source .venv/bin/activate

# 设置 Python 路径
export PYTHONPATH="$SCRIPT_DIR"

# 运行播客生成
python app/podcast_pipeline.py "$@"

# 完成后显示帮助
echo ""
echo "========================================"
echo "使用说明:"
echo "  ./run_podcast.sh              # 生成今天的播客"
echo "  ./run_podcast.sh 2026-02-06  # 生成指定日期的播客"
echo "  ./run_podcast.sh --audio-only # 仅生成音频（跳过 LLM）"
echo "  ./run_podcast.sh --merge-only # 仅合并音频"
echo "========================================"
