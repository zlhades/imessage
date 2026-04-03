#!/usr/bin/env python3
"""
Send iMessage CLI Tool

命令行发送 iMessage 到指定联系人。
用法：python3 send_imessage.py <联系人> <消息内容>
"""

import subprocess
import sys


def send_imessage(contact: str, message: str) -> bool:
    """发送 iMessage"""
    try:
        clean_msg = message.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`').replace('\n', ' ')
        result = subprocess.run([
            'osascript',
            '-e', 'tell application "Messages"',
            '-e', f'send "{clean_msg}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
            '-e', 'end tell'
        ], capture_output=True, text=True, timeout=10)

        return result.returncode == 0
    except Exception as e:
        print(f"❌ 异常：{e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法：python3 send_imessage.py <联系人> <消息内容>")
        print("示例：python3 send_imessage.py zlhades@icloud.com 'Hello World'")
        sys.exit(1)

    contact = sys.argv[1]
    message = sys.argv[2]

    if send_imessage(contact, message):
        print(f"✅ 已发送 iMessage 到 {contact}")
    else:
        print("❌ 发送失败")
        sys.exit(1)
