#!/usr/bin/env python3
"""
iMessage 监听器 v8 - 完整版

功能：
1. 监听消息并注入到 Qwen
2. 发送确认回复
3. 监控 Qwen 执行完成
4. 自动发送 Summary 回复
"""

import sqlite3, os, sys, time, subprocess, re
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
TMUX = "qwen_imsg"
LOG = "/tmp/qwen_imsg.log"
DONE = "/tmp/qwen_imsg_done.txt"
CONTACTS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
AUTO_MARKERS = ["✅", "📊", "❌", "🚀", "👋", "[自动]"]

def log(msg):
    t = datetime.now().strftime('%H:%M:%S')
    line = f"[{t}] {msg}"
    print(line)
    open(LOG, 'a').write(line + "\n")

def send_imessage(contact, msg):
    log(f"📤 发送到 {contact}: {msg[:50]}...")
    clean = msg.replace('"', '\\"').replace('\n', ' ')
    subprocess.run(['osascript', '-e', 'tell application "Messages"', '-e', f'send "{clean}" to buddy "{contact}" of (service 1 whose service type is iMessage)', '-e', 'end tell'], capture_output=True)
    log(f"✅ 发送成功")

def get_last_message():
    if not os.path.exists(DB): return None, None
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    ph = ','.join('?' * len(CONTACTS))
    c.execute(f"SELECT m.text, h.id FROM message m JOIN handle h ON m.handle_id = h.rowid WHERE h.id IN ({ph}) AND m.text IS NOT NULL AND m.is_from_me = 0 ORDER BY m.date DESC LIMIT 1", CONTACTS)
    r = c.fetchone()
    conn.close()
    if r and r[0]:
        if any(m in r[0] for m in AUTO_MARKERS): return None, None
        return (r[0], r[1])
    return (None, None)

def inject(text):
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
    """获取 Qwen 的最新输出"""
    result = subprocess.run(['tmux', 'capture-pane', '-t', TMUX, '-p'], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else ""

def check_execution_complete(last_text):
    """检查 Qwen 是否执行完成"""
    output = get_qwen_output()
    # 检查执行完成的标志
    complete_markers = [
        "执行完成", "已完成", "Finished", "Done",
        "Would you like", "还有什么", "随时可以",
        "╰─", "└──",  # 树形输出结束
    ]
    for marker in complete_markers:
        if marker in output:
            return True
    return False

def generate_summary(command, output):
    """生成执行 Summary"""
    # 截取输出
    if len(output) > 200:
        output = output[:200] + "..."
    return f"📊 执行完成\n\n指令：{command}\n\n结果：{output}"

def main():
    log("╔═══════════════════════════════════╗")
    log("║  监听器 v8 - 带 Summary 回复        ║")
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
    pending = None  # 待发送 Summary 的消息
    pending_contact = None
    start_time = None
    
    try:
        while True:
            # 1. 检查新消息
            msg, contact = get_last_message()
            if msg and msg != last_msg:
                log(f"\n🔔 新消息 from {contact}: {msg[:40]}...")
                if msg not in done:
                    if inject(msg):
                        n += 1
                        # 发送确认
                        send_imessage(contact, f"✅ 收到：{msg[:30]}... 正在处理")
                        # 设置待处理
                        pending = msg
                        pending_contact = contact
                        start_time = time.time()
                        done.add(msg)
                        open(DONE, 'w').write('\n'.join(done))
                last_msg = msg
            
            # 2. 检查执行完成
            if pending and start_time and (time.time() - start_time) > 10:  # 10 秒后检查
                if check_execution_complete(pending):
                    log(f"✅ 执行完成，发送 Summary")
                    output = get_qwen_output()
                    summary = generate_summary(pending, output)
                    send_imessage(pending_contact, summary)
                    pending = None
                    start_time = None
            
            time.sleep(3)
    
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")

if __name__ == "__main__":
    main()
