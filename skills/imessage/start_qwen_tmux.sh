#!/bin/bash
# start_qwen_tmux.sh
# 创建 tmux 会话并启动 Qwen CLI

SESSION_NAME="qwen_imsg"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        启动 Qwen CLI tmux 会话                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# 检查 tmux 是否安装
if ! command -v tmux &> /dev/null; then
    echo "❌ 错误：tmux 未安装"
    echo "请运行：brew install tmux"
    exit 1
fi

# 检查会话是否已存在
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "⚠️  会话 '$SESSION_NAME' 已存在"
    echo "   附加到现有会话：tmux attach -t $SESSION_NAME"
    echo "   或删除后重建：tmux kill-session -t $SESSION_NAME"
    exit 0
fi

# 创建新会话并启动 Qwen CLI
echo "🚀 创建 tmux 会话：$SESSION_NAME"
tmux new-session -d -s $SESSION_NAME

# 发送欢迎消息
tmux send-keys -t $SESSION_NAME "echo '╔═══════════════════════════════════════════════════════════╗'" Enter
tmux send-keys -t $SESSION_NAME "echo '║        Qwen CLI iMessage 监听会话                          ║'" Enter
tmux send-keys -t $SESSION_NAME "echo '╚═══════════════════════════════════════════════════════════╝'" Enter
tmux send-keys -t $SESSION_NAME "echo ''" Enter
tmux send-keys -t $SESSION_NAME "echo '📱 此会话由 iMessage 监听器控制'" Enter
tmux send-keys -t $SESSION_NAME "echo '📧 发送 iMessage 到 zlhades@icloud.com 或 zlhades@hotmail.com'" Enter
tmux send-keys -t $SESSION_NAME "echo '⚡ 消息将自动注入到此会话并执行'" Enter
tmux send-keys -t $SESSION_NAME "echo ''" Enter

# 启动 Qwen CLI
echo "🤖 启动 Qwen CLI..."
tmux send-keys -t $SESSION_NAME "qwen" Enter

echo "✅ tmux 会话已创建"
echo ""
echo "📋 使用方法："
echo "   查看会话：tmux attach -t $SESSION_NAME"
echo "   分离会话：Ctrl+B 然后按 D"
echo "   关闭会话：tmux kill-session -t $SESSION_NAME"
echo ""
echo "现在启动监听脚本..."
sleep 2

# 启动监听脚本
python3 /Users/benson/Documents/incident/skills/imessage/watch_and_inject.py &
echo "✅ 监听脚本已启动 (PID: $!)"
