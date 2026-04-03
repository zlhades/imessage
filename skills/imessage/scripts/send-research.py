#!/usr/bin/env python3
import subprocess

# 分 3 条消息发送
messages = [
    '🔍 长期监听方案研究\n\n✅ 推荐方案:\nQwen Code + MCP + 后台进程\n\n3 种实现方式:\n1️⃣ tmux 后台 (简单)\n2️⃣ systemd 服务 (稳定)\n3️⃣ Docker 容器 (隔离)',
    '📋 架构对比:\n\n轮询 (Polling)\n• 简单，但浪费资源\n• 适合低频检查\n\nWebhook\n• 实时，高效\n• 需要外部服务支持\n\nMCP 长连接\n• 最佳方案\n• 状态持久化',
    '🎯 最佳实践:\n\n1. Redis/SQLite 存储状态\n2. 检查点机制 (防丢失)\n3. 心跳检测 (防宕机)\n4. 日志轮转 (防爆满)\n\n你的 iMessage 系统已实现 1,2!']
]

for msg in messages:
    # 转义特殊字符
    escaped_msg = msg.replace('"', '\\"').replace('\n', '\\n')
    script = f'''
    tell application "Messages"
        set targetService to 1st service whose service type is iMessage
        set targetBuddy to buddy "zlhades@icloud.com" of targetService
        send "{escaped_msg}" to targetBuddy
    end tell
    '''
    subprocess.run(['osascript', '-e', script], capture_output=True)

print('✅ 已发送长期监听方案 iMessage')
