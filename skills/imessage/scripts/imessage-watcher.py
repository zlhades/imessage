#!/usr/bin/env python3
"""
iMessage 监听器 - 持续监控新消息并自动执行

用法：
    python3 imessage-watcher.py [联系人] [间隔秒数]
    
示例：
    python3 imessage-watcher.py zlhades@icloud.com 5
"""

import json
import subprocess
import sys
import time
import os
from datetime import datetime

CONTACT = sys.argv[1] if len(sys.argv) > 1 else "zlhades@icloud.com"
INTERVAL = int(sys.argv[2]) if len(sys.argv) > 2 else 5

print("╔═══════════════════════════════════════════════════════════╗")
print("║        iMessage 监听器 - 持续监控新消息并自动执行          ║")
print("╚═══════════════════════════════════════════════════════════╝")
print()
print(f"📱 监听联系人：{CONTACT}")
print(f"⏱️  检查间隔：{INTERVAL} 秒")
print(f"📅 开始时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()
print("按 Ctrl+C 停止监听")
print()
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

# 获取最后一条消息 ID
def get_last_message_id():
    result = subprocess.run(
        ["python3", "/Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py", "read", CONTACT],
        capture_output=True,
        text=True
    )
    try:
        data = json.loads(result.stdout)
        return data.get('id', 0)
    except:
        return 0


# 获取消息内容
def get_message_by_id(msg_id):
    result = subprocess.run(
        ["python3", "/Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py", "search", CONTACT, "1"],
        capture_output=True,
        text=True
    )
    try:
        messages = json.loads(result.stdout)
        for msg in messages:
            if msg.get('id') == msg_id:
                return msg
    except:
        pass
    return None


# 执行消息中的指令
def execute_message(message):
    text = message.get('text', '')
    
    print(f"\n📱 新消息内容：{text}")
    print("\n🔍 分析并执行中...\n")
    
    prompt = f"""请执行这条 iMessage 消息中的指令：

【消息】
{text}

【任务】
1. 识别可执行指令
2. 执行任务
3. 返回结果

请开始："""

    result = subprocess.run(
        ["qwen", "-p", prompt, "-y"],
        capture_output=True,
        text=True,
        timeout=120
    )
    
    print(result.stdout)
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


# 主循环
last_id = get_last_message_id()
print(f"✅ 初始消息 ID: {last_id}")
print(f"🕐 {datetime.now().strftime('%H:%M:%S')} - 开始监听...\n")

try:
    while True:
        current_id = get_last_message_id()
        
        if current_id != last_id and current_id != 0:
            # 发现新消息！
            print(f"\n🔔 {datetime.now().strftime('%H:%M:%S')} - 发现新消息 (ID: {current_id})")
            
            message = get_message_by_id(current_id)
            if message and message.get('text') != '[无内容]':
                execute_message(message)
            else:
                print("⚠️ 消息无内容，跳过")
            
            last_id = current_id
        else:
            # 无新消息
            print(f"🕐 {datetime.now().strftime('%H:%M:%S')} - 无新消息 (当前 ID: {current_id})")
        
        time.sleep(INTERVAL)

except KeyboardInterrupt:
    print("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("👋 监听已停止")
    print(f"📅 结束时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
