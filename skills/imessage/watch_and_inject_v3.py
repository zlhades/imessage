#!/usr/bin/env python3
"""watch_and_inject_v3.py - AppleScript 版"""

import os, sys, time, subprocess
from datetime import datetime

PROCESSED_FILE = "/tmp/qwen_imsg_processed.txt"
TMUX_SESSION = "qwen_imsg"
CHECK_INTERVAL = 3
LOG_FILE = "/tmp/qwen_imsg_inject.log"

def log(msg):
    ts = datetime.now().strftime('%H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, 'a') as f:
        f.write(line + "\n")
        f.flush()

def get_processed_ids():
    if not os.path.exists(PROCESSED_FILE):
        return set()
    with open(PROCESSED_FILE, 'r') as f:
        return set(line.strip() for line in f if line.strip())

def save_processed_id(msg_id):
    with open(PROCESSED_FILE, 'a') as f:
        f.write(f"{msg_id}\n")

def get_last_message():
    try:
        script = '''tell application "Messages"
            set latest to ""
            set latest_date to 0
            repeat with chat_item in chats
                try
                    set msgs to messages of chat_item
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set msg_date to date of msg
                        if msg_date > latest_date then
                            set latest to content of msg
                            set latest_date to msg_date
                        end if
                    end if
                end try
            end repeat
            return latest
        end tell'''
        result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=10)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        return None
    except Exception as e:
        log(f"⚠️ AppleScript 错误：{e}")
        return None

def inject_to_tmux(text):
    if not subprocess.run(['tmux', 'has-session', '-t', TMUX_SESSION], capture_output=True).returncode == 0:
        log(f"❌ tmux 会话不存在")
        return False
    clean = text.replace('\\', '\\\\').replace('"', '\\"')
    log(f"🎯 注入：{clean[:50]}...")
    result = subprocess.run(['tmux', 'send-keys', '-t', TMUX_SESSION, clean, 'Enter'], capture_output=True)
    if result.returncode == 0:
        log(f"✅ 注入成功")
        return True
    log(f"❌ 注入失败：{result.stderr.decode()}")
    return False

def main():
    log("╔═══════════════════════════════════════════════════════════╗")
    log("║     iMessage → tmux 注入监听器 v3                          ║")
    log("╚═══════════════════════════════════════════════════════════╝")
    log(f"📱 监听：{TMUX_SESSION}")
    log(f"⏱️  间隔：{CHECK_INTERVAL}秒")
    
    if not subprocess.run(['tmux', 'has-session', '-t', TMUX_SESSION], capture_output=True).returncode == 0:
        log(f"❌ tmux 会话 '{TMUX_SESSION}' 不存在")
        sys.exit(1)
    
    processed = get_processed_ids()
    last_msg = None
    log("🕐 开始监听...")
    
    count = 0
    try:
        while True:
            msg = get_last_message()
            if msg and msg != last_msg:
                log(f"\n🔔 新消息：{msg[:50]}...")
                msg_hash = hash(msg)
                if msg_hash not in processed:
                    if inject_to_tmux(msg):
                        count += 1
                    save_processed_id(msg_hash)
                    processed.add(msg_hash)
                last_msg = msg
            time.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共注入 {count} 条)")

if __name__ == "__main__":
    main()
