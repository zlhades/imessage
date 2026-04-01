#!/usr/bin/env python3
"""
简易 iMessage 回复工具 - 供 Qwen 调用

用法：
python3 imessage-reply-simple.py "zlhades@icloud.com" "执行结果：Hello World"
"""

import subprocess
import sys


def send_imessage(contact, message):
    """发送 iMessage"""
    try:
        # 转义特殊字符
        message = message.replace('"', '\\"').replace('\n', ' ')
        
        script = f'''
        tell application "Messages"
            set targetService to 1st service whose service type is iMessage
            set targetBuddy to buddy "{contact}" of targetService
            send "{message}" to targetBuddy
        end tell
        '''
        
        subprocess.run(['osascript', '-e', script], capture_output=True, check=True)
        return True
    except Exception as e:
        print(f"发送失败：{e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法：python3 imessage-reply-simple.py <联系人> <消息内容>")
        sys.exit(1)
    
    contact = sys.argv[1]
    message = sys.argv[2]
    
    if send_imessage(contact, message):
        print(f"✅ 已发送 iMessage 到 {contact}")
    else:
        print(f"❌ 发送失败")
        sys.exit(1)
