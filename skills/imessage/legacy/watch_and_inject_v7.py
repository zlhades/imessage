#!/usr/bin/env python3
"""
iMessage 监听器 v7 - 修复输入框残留 bug

修复：
1. 注入前先清除输入框
2. 确保 Enter 键正确发送
3. 添加延迟确保消息完全发送
"""

import sqlite3
import os
import sys
import time
import subprocess
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
TMUX = "qwen_imsg"
LOG = "/tmp/qwen_imsg_inject.log"
DONE = "/tmp/qwen_imsg_done.txt"
CONTACTS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
AUTO_REPLY_MARKERS = ["✅", "📊", "❌", "🚀", "👋", "[自动回复]", "执行完成", "执行报告"]

def log(msg):
    t = datetime.now().strftime('%H:%M:%S')
    line = f"[{t}] {msg}"
    print(line)
    open(LOG, 'a').write(line + "\n")
    open(LOG, 'a').flush()

def is_auto_reply(text):
    for marker in AUTO_REPLY_MARKERS:
        if marker in text:
            return True
    return False

def send_imessage(contact, message):
    log(f"📤 发送到 {contact}: {message[:50]}...")
    try:
        clean_msg = message.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`').replace('\n', ' ')
        result = subprocess.run([
            'osascript',
            '-e', 'tell application "Messages"',
            '-e', f'send "{clean_msg}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
            '-e', 'end tell'
        ], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            log(f"✅ 发送成功")
            return True
        else:
            log(f"❌ 发送失败：{result.stderr[:100]}")
            return False
    except Exception as e:
        log(f"❌ 异常：{e}")
        return False

def get_last_message():
    if not os.path.exists(DB):
        return None, None
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    placeholders = ','.join('?' * len(CONTACTS))
    c.execute(f"""
        SELECT m.text, m.is_from_me, h.id as contact
        FROM message m
        JOIN handle h ON m.handle_id = h.rowid
        WHERE h.id IN ({placeholders})
          AND m.text IS NOT NULL AND m.text != ''
          AND m.is_from_me = 0
        ORDER BY m.date DESC
        LIMIT 1
    """, CONTACTS)
    r = c.fetchone()
    conn.close()
    if r and r[0]:
        text = r[0]
        if is_auto_reply(text):
            log(f"⚠️ 忽略自动回复：{text[:30]}...")
            return None, None
        return (text, r[2])
    return (None, None)

def inject(text):
    """注入消息到 tmux - 修复版"""
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log("❌ tmux 无")
        return False
    
    log(f"🎯 注入：{text[:40]}...")
    
    # 步骤 1: 清除当前输入框（Ctrl+C 取消当前输入）
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'C-c'], capture_output=True)
    time.sleep(0.2)
    
    # 步骤 2: 确保光标在输入位置（按 End 键到行尾）
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'End'], capture_output=True)
    time.sleep(0.1)
    
    # 步骤 3: 逐字输入消息（避免特殊字符问题）
    # 对于中文，直接发送整个字符串
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, text], capture_output=True)
    time.sleep(0.3)
    
    # 步骤 4: 按 Enter 发送
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'Enter'], capture_output=True)
    time.sleep(0.5)  # 等待消息完全发送
    
    log(f"✅ 已发送")
    return True

def main():
    log("╔═══════════════════════════════════╗")
    log("║  监听器 v7 - 修复输入框残留        ║")
    log("╚═══════════════════════════════════╝")
    
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log(f"❌ tmux '{TMUX}' 无")
        sys.exit(1)
    
    log(f"📱 监听：{', '.join(CONTACTS)}")
    log(f"🎯 tmux: {TMUX}")
    log(f"🛡️  防死循环：启用")
    
    done = set()
    if os.path.exists(DONE):
        done = set(open(DONE).read().strip().split('\n'))
    
    last_msg, _ = get_last_message()
    log(f"✅ 开始 (最后：{last_msg[:30] if last_msg else '无'})")
    
    n = 0
    try:
        while True:
            msg, contact = get_last_message()
            
            if msg and msg != last_msg:
                log(f"\n🔔 新消息 from {contact}: {msg[:40]}...")
                
                if msg not in done:
                    if inject(msg):
                        n += 1
                        reply = f"✅ 收到：{msg[:30]}..."
                        send_imessage(contact, reply)
                    
                    done.add(msg)
                    open(DONE, 'w').write('\n'.join(done))
                
                last_msg = msg
            
            time.sleep(3)
    
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")

if __name__ == "__main__":
    main()
