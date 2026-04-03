#!/usr/bin/env python3
"""
iMessage 监听器 v13 - Prompt 方案（用户原创想法）

核心思路（用户提出）：
注入消息时附加一句话："执行完后发 iMessage 给我"
这样 Qwen 会自动执行并发送结果，不需要等待！
"""

import sqlite3, os, sys, time, subprocess
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
TMUX = "qwen_imsg"
LOG = "/tmp/qwen_imsg.log"
DONE = "/tmp/qwen_imsg_done.txt"
CONTACTS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
AUTO_MARKERS = ["✅", "📊", "❌", "🚀", "👋", "[自动]", "执行完成", "收到："]

# 附加的 Prompt - 简单直接
INJECT_PROMPT = """

【执行后请回复】
请在执行完成后，运行以下命令发送 iMessage 到 zlhades@icloud.com：
osascript -e 'tell application "Messages" to send "📊 执行完成：{result}" to buddy "zlhades@icloud.com" of (service 1 whose service type is iMessage)'

请将{result}替换为实际执行结果。
"""

def log(msg):
    t = datetime.now().strftime('%H:%M:%S')
    line = f"[{t}] {msg}"
    print(line)
    open(LOG, 'a').write(line + "\n")

def send_imessage(contact, msg):
    log(f"📤 发送到 {contact}: {msg[:50]}...")
    clean = msg.replace('"', '\\"').replace('\n', ' ')
    subprocess.run([
        'osascript',
        '-e', 'tell application "Messages"',
        '-e', f'send "{clean}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
        '-e', 'end tell'
    ], capture_output=True)
    log(f"✅ 发送成功")

def get_last_message():
    if not os.path.exists(DB): return None, None
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    ph = ','.join('?' * len(CONTACTS))
    c.execute(f"""
        SELECT m.text, m.is_from_me, h.id as contact
        FROM message m JOIN handle h ON m.handle_id = h.rowid
        WHERE h.id IN ({ph}) AND m.text IS NOT NULL AND m.text != '' AND m.is_from_me = 0
        ORDER BY m.date DESC LIMIT 1
    """, CONTACTS)
    r = c.fetchone()
    conn.close()
    if r and r[0]:
        if any(m in r[0] for m in AUTO_MARKERS):
            log(f"⚠️ 忽略：{r[0][:30]}...")
            return None, None
        return (r[0], r[2])
    return (None, None)

def inject_with_prompt(text):
    """注入消息 + Prompt"""
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log("❌ tmux 无")
        return False
    
    # 简单直接：消息 + Prompt
    full = f"{text}\n\n{INJECT_PROMPT}"
    
    log(f"🎯 注入：{text[:30]}...")
    log(f"📝 Prompt: {len(INJECT_PROMPT)} 字符")
    
    # 清除输入
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'C-c'], capture_output=True)
    time.sleep(0.2)
    
    # 输入
    for line in full.split('\n'):
        subprocess.run(['tmux', 'send-keys', '-t', TMUX, line + '\n'], capture_output=True)
        time.sleep(0.03)
    
    time.sleep(0.3)
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'Enter'], capture_output=True)
    
    log(f"✅ 已发送 (带 Prompt)")
    return True

def main():
    log("╔═══════════════════════════════════╗")
    log("║  v13 - Prompt 方案 (用户原创)      ║")
    log("╚═══════════════════════════════════╝")
    
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log(f"❌ tmux '{TMUX}' 无")
        sys.exit(1)
    
    log(f"📱 监听：{', '.join(CONTACTS)}")
    log(f"📝 Prompt 注入：启用")
    
    done = set()
    if os.path.exists(DONE):
        done = set(open(DONE).read().strip().split('\n'))
    
    last_msg, _ = get_last_message()
    log(f"✅ 开始")
    
    n = 0
    try:
        while True:
            msg, contact = get_last_message()
            if msg and msg != last_msg:
                log(f"\n🔔 新消息 from {contact}: {msg[:40]}...")
                if msg not in done:
                    if inject_with_prompt(msg):
                        n += 1
                        send_imessage(contact, f"✅ 收到：{msg[:30]}... Qwen 执行后会发送结果")
                        done.add(msg)
                        open(DONE, 'w').write('\n'.join(done))
                last_msg = msg
            time.sleep(2)
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")

if __name__ == "__main__":
    main()
