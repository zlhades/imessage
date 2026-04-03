#!/usr/bin/env python3
"""
iMessage 闭环系统 - 快速启动

用法：
    ./imessage-loop "zlhades@icloud.com" "帮我创建一个文件 /tmp/test.txt，内容是 Hello"
"""

import subprocess
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def send_message(contact, message):
    """发送 iMessage"""
    try:
        script = f'''
        tell application "Messages"
            set targetService to 1st service whose service type is iMessage
            set targetBuddy to buddy "{contact}" of targetService
            send "{message.replace('"', '\\"')}" to targetBuddy
        end tell
        '''
        
        subprocess.run(
            ['osascript', '-e', script],
            check=True,
            capture_output=True
        )
        
        print(f"✅ 消息已发送：{contact}")
        return True
        
    except Exception as e:
        print(f"❌ 发送失败：{e}")
        return False


def main():
    if len(sys.argv) < 3:
        print("╔═══════════════════════════════════════════════════════════╗")
        print("║     iMessage 闭环系统 - 快速启动                          ║")
        print("╚═══════════════════════════════════════════════════════════╝")
        print()
        print("用法：python3 imessage-loop.py <联系人> <消息内容>")
        print()
        print("示例：")
        print('  python3 imessage-loop.py "zlhades@icloud.com" "运行 ls -la"')
        print('  python3 imessage-loop.py "zlhades@icloud.com" "创建文件 /tmp/test.txt，内容是 Hello"')
        print()
        print("功能：")
        print("  1. 发送 iMessage 到指定联系人")
        print("  2. 自动监听器检测到新消息")
        print("  3. 自动执行指令")
        print("  4. 自动发送 Summary 回复")
        print()
        sys.exit(1)
    
    contact = sys.argv[1]
    message = sys.argv[2]
    
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║     iMessage 闭环系统 - 启动中...                          ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print()
    
    # 步骤 1: 发送消息
    print(f"📱 发送消息到 {contact}...")
    print(f"💬 内容：{message}")
    send_message(contact, message)
    print()
    
    # 步骤 2: 提示用户
    print("⏳ 等待自动监听器处理...")
    print()
    print("监听器会自动：")
    print("  1. 检测到新消息")
    print("  2. 发送'📥 收到指令，正在处理...'回复")
    print("  3. 执行指令")
    print("  4. 发送 Summary 回复")
    print()
    print("请检查你的 iMessage 收到回复！")
    print()
    
    # 步骤 3: 可选 - 自动触发执行
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("提示：如果要立即执行（不等待监听器）：")
    print(f"  python3 {SCRIPT_DIR}/imessage-run.py \"{contact}\"")


if __name__ == "__main__":
    main()
