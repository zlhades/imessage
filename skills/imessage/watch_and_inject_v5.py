#!/usr/bin/env python3
"""
iMessage 监听器 v5.1 - 带自动回复闭环（改进版）
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

def log(msg):
    t = datetime.now().strftime('%H:%M:%S')
    line = f"[{t}] {msg}"
    print(line)
    open(LOG, 'a').write(line + "\n")
    open(LOG, 'a').flush()

def send_imessage(contact, message):
    """发送 iMessage"""
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
            # 验证：检查数据库
            time.sleep(1)
            conn = sqlite3.connect(DB)
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM message WHERE is_from_me=1 ORDER BY date DESC LIMIT 1")
            count = c.fetchone()[0]
            conn.close()
            log(f"📋 数据库验证：最新发送消息数={count}")
            return True
        else:
            log(f"❌ 发送失败：{result.stderr[:100]}")
            return False
    except Exception as e:
        log(f"❌ 异常：{e}")
        return False

def get_last_message():
    """获取最新消息"""
    if not os.path.exists(DB):
        return None, None
    
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    placeholders = ','.join('?' * len(CONTACTS))
    c.execute(f"""
        SELECT m.text, h.id as contact
        FROM message m
        JOIN handle h ON m.handle_id = h.rowid
        WHERE h.id IN ({placeholders})
          AND m.text IS NOT NULL AND m.text != ''
        ORDER BY m.date DESC 
        LIMIT 1
    """, CONTACTS)
    r = c.fetchone()
    conn.close()
    
    return (r[0], r[1]) if r and r[0] else (None, None)

def inject(text):
    """注入到 tmux"""
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log("❌ tmux 无")
        return False
    
    log(f"🎯 注入：{text[:40]}...")
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, text, 'Enter'], capture_output=True)
    log(f"✅ 已发送")
    return True

def main():
    log("╔═══════════════════════════════════╗")
    log("║  监听器 v5.1 - 改进版              ║")
    log("╚═══════════════════════════════════╝")
    
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log(f"❌ tmux '{TMUX}' 无")
        sys.exit(1)
    
    log(f"📱 监听：{', '.join(CONTACTS)}")
    log(f"🎯 tmux: {TMUX}")
    
    done = set()
    if os.path.exists(DONE):
        done = set(open(DONE).read().strip().split('\n'))
    
    last_msg, _ = get_last_message()
    log(f"✅ 开始 (最后：{last_msg[:30] if last_msg else '无'})")
    
    # 发送启动通知
    send_imessage(CONTACTS[0], f"🚀 监听器 v5.1 已启动")
    
    n = 0
    try:
        while True:
            msg, contact = get_last_message()
            
            if msg and msg != last_msg:
                log(f"\n🔔 新消息 from {contact}: {msg[:40]}...")
                
                if msg not in done:
                    if inject(msg):
                        n += 1
                        # 发送确认回复
                        reply = f"✅ 收到：{msg[:30]}... 正在处理"
                        send_imessage(contact, reply)
                    
                    done.add(msg)
                    open(DONE, 'w').write('\n'.join(done))
                
                last_msg = msg
            
            time.sleep(3)
    
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")
        send_imessage(CONTACTS[0], f"👋 监听器已停止 (共{n}条)")

if __name__ == "__main__":
    main()
