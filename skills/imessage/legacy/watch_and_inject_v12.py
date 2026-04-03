#!/usr/bin/env python3
"""
iMessage 监听器 v12 - 智能等待版

改进：
1. 立即发送"收到"确认
2. 智能检测 Qwen 是否完成（检测输出变化）
3. 完成后发送真实结果
"""

import sqlite3, os, sys, time, subprocess
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
TMUX = "qwen_imsg"
LOG = "/tmp/qwen_imsg.log"
DONE = "/tmp/qwen_imsg_done.txt"
CONTACTS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
AUTO_MARKERS = ["✅", "📊", "❌", "🚀", "👋", "[自动]", "执行完成", "收到："]

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
            log(f"⚠️ 忽略自动回复：{r[0][:30]}...")
            return None, None
        return (r[0], r[2])
    return (None, None)

def inject(text):
    """注入消息到 tmux"""
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log("❌ tmux 无")
        return False
    
    log(f"🎯 注入：{text[:40]}...")
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'C-c'], capture_output=True)
    time.sleep(0.2)
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, text, 'Enter'], capture_output=True)
    time.sleep(0.5)
    log(f"✅ 已发送")
    return True

def get_qwen_output():
    """获取 Qwen 输出"""
    result = subprocess.run(['tmux', 'capture-pane', '-t', TMUX, '-p', '-S', '-500'], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else ""

def check_finished(last_output):
    """
    智能检测 Qwen 是否完成
    
    完成标志：
    1. 输出包含完成标记
    2. 输出稳定（5 秒内无变化）
    """
    current = get_qwen_output()
    
    # 检查完成标记
    markers = ["? for shortcuts", "Would you like", "Type your message", "╰─", "└──"]
    for m in markers:
        if m in current:
            # 输出稳定检查
            if current == last_output:
                return True, current
    
    return False, current

def main():
    log("╔═══════════════════════════════════╗")
    log("║  v12 - 智能等待版                  ║")
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
    log(f"✅ 开始")
    
    n = 0
    pending = None
    pending_contact = None
    start_time = None
    last_output = ""
    stable_count = 0
    
    try:
        while True:
            # 1. 检查新消息
            msg, contact = get_last_message()
            if msg and msg != last_msg:
                log(f"\n🔔 新消息 from {contact}: {msg[:40]}...")
                if msg not in done:
                    if inject(msg):
                        n += 1
                        send_imessage(contact, f"✅ 收到：{msg[:30]}...")
                        pending = msg
                        pending_contact = contact
                        start_time = time.time()
                        done.add(msg)
                        open(DONE, 'w').write('\n'.join(done))
                        last_output = ""
                        stable_count = 0
                last_msg = msg
            
            # 2. 智能等待 Qwen 完成
            if pending and start_time:
                elapsed = time.time() - start_time
                
                # 5 秒后开始检查（给 Qwen 时间开始执行）
                if elapsed > 5:
                    finished, current_output = check_finished(last_output)
                    
                    if finished:
                        log(f"✅ Qwen 完成，发送结果...")
                        # 提取最后部分作为结果
                        lines = current_output.split('\n')
                        result = '\n'.join(lines[-50:])
                        if len(result) > 400:
                            result = result[:400] + "..."
                        summary = f"📊 执行完成\n\n指令：{pending[:50]}\n\n结果:\n{result}"
                        send_imessage(pending_contact, summary)
                        pending = None
                        start_time = None
                    
                    # 超时 (2 分钟)
                    elif elapsed > 120:
                        log(f"⏱️ 超时")
                        send_imessage(pending_contact, f"⏱️ 执行超时")
                        pending = None
                        start_time = None
                    
                    last_output = current_output
            
            time.sleep(2)
    
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")

if __name__ == "__main__":
    main()
