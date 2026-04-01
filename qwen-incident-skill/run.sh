#!/bin/bash
#
# Incident Response Skill - 一键启动
#
# 用法：./run.sh
#
# 前提条件:
# 1. 已安装 Qwen Code CLI
# 2. 已配置 QWEN_API_KEY
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompt_template.txt"
CONTEXT_FILE="$SCRIPT_DIR/context.txt"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查文件是否存在
check_files() {
    if [ ! -f "$PROMPT_FILE" ]; then
        echo -e "${RED}错误：找不到 prompt_template.txt${NC}"
        exit 1
    fi
    
    if [ ! -f "$CONTEXT_FILE" ]; then
        echo -e "${YELLOW}警告：context.txt 不存在，将创建空文件${NC}"
        cat > "$CONTEXT_FILE" << 'EOF'
# Incident Context

请将 Slack 讨论记录、日志片段等粘贴到下方：

---

## Slack 讨论记录

```
[10:01] user1: 支付服务报错 503
[10:05] user2: 发现数据库连接池满
```

## 错误日志

```
2026-03-31 10:01:00 ERROR Connection pool exhausted
```

---
EOF
        echo -e "${GREEN}已创建 context.txt，请编辑后重新运行${NC}"
        exit 0
    fi
}

# 检查 Qwen Code CLI
check_qwen() {
    if ! command -v qwen &> /dev/null; then
        echo -e "${RED}错误：未找到 qwen 命令${NC}"
        echo "请先安装 Qwen Code CLI:"
        echo "  npm install -g @anthropics/qwen-code-cli"
        echo "或参考：https://github.com/anthropics/qwen-code"
        exit 1
    fi
}

# 检查 API Key
check_api_key() {
    if [ -z "$QWEN_API_KEY" ]; then
        echo -e "${RED}错误：未设置 QWEN_API_KEY${NC}"
        echo "请执行：export QWEN_API_KEY=sk-..."
        echo "或添加到 ~/.bashrc / ~/.zshrc"
        exit 1
    fi
}

# 显示使用说明
show_usage() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Incident Response Skill - 事故响应智能体                ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}用法:${NC}"
    echo "  ./run.sh              # 启动智能体"
    echo "  ./run.sh --edit       # 编辑 context.txt"
    echo "  ./run.sh --help       # 显示帮助"
    echo ""
    echo -e "${GREEN}流程:${NC}"
    echo "  1. 将 Slack 讨论记录复制到 context.txt"
    echo "  2. 运行 ./run.sh 启动智能体"
    echo "  3. 如有新消息，追加到 context.txt 并告知智能体"
    echo "  4. 获取结构化事故报告"
    echo ""
}

# 主函数
main() {
    case "${1:-}" in
        --edit|-e)
            ${EDITOR:-vim} "$CONTEXT_FILE"
            exit 0
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
    esac
    
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Incident Response Skill - 启动中...                    ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # 检查
    check_files
    check_qwen
    check_api_key
    
    # 显示 context.txt 内容摘要
    echo -e "${YELLOW}📄 当前上下文:${NC}"
    echo "---"
    head -20 "$CONTEXT_FILE"
    if [ $(wc -l < "$CONTEXT_FILE") -gt 20 ]; then
        echo "... (共 $(wc -l < "$CONTEXT_FILE") 行)"
    fi
    echo "---"
    echo ""
    
    # 启动 Qwen Code
    echo -e "${GREEN}🚀 启动 Qwen Code 智能体...${NC}"
    echo ""
    echo -e "${YELLOW}提示:${NC}"
    echo "  - 如有新消息，请追加到 context.txt"
    echo "  - 然后输入：'context.txt 已更新，请重新评估'"
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # 运行 Qwen Code
    qwen code --teammate-mode tmux "$(cat "$PROMPT_FILE")"
}

# 执行
main "$@"
