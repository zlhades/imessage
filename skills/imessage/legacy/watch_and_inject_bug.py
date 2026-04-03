#!/usr/bin/env python3
"""
有 Bug 的版本 - 用于重现问题
"""
import sqlite3, os, sys, time, subprocess
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
TMUX = "qwen_imsg"
LOG = "/tmp/qwen_bug.log"
CONTACTS = ["zlhades@icloud.com"]

def log(msg):
    t = datetime.now().strftime('%H:%M:%S')
    print(f"[{t}] {msg}")

def get_msg():
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    c.execute("SELECT text FROM message WHERE is_from_me=0 AND text IS NOT NULL ORDER BY rowid DESC LIMIT 1")
    r = c.fetchone()
    conn.close()
    return r[0] if r and r[0] else None

def inject_buggy(text):
    """有 Bug 的注入 - 不清除输入框"""
    log(f"🎯 注入 (Bug 版): {text[:30]}...")
    # Bug: 直接发送，不清除输入框
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, text, 'Enter'], capture_output=True)
    log("✅ 已发送")

def main():
    log("╔═══════════════════════╗")
    log("║  Bug 版本 - 重现问题   ║")
    log("╚═══════════════════════╝")
    
    last = None
    while True:
        msg = get_msg()
        if msg and msg != last:
            log(f"🔔 新：{msg[:30]}...")
            inject_buggy(msg)
            last = msg
        time.sleep(2)

if __name__ == "__main__":
    main()
