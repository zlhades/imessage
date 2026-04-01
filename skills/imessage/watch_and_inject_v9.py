#!/usr/bin/env python3
"""
iMessage 监听器 v9 - 严格防死循环版

关键改进：
1. 只监听 is_from_me=0 的消息（别人发来的）
2. Summary 回复标记为 is_from_me=1（自己发送的）
3. 双重检查：即使数据库有误，也忽略包含标记的消息
"""

import sqlite3, os, sys, time, subprocess
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
TMUX = "qwen_imsg"
LOG = "/tmp/qwen_imsg.log"
DONE = "/tmp/qwen_imsg_done.txt"
CONTACTS = ["zlhades@icloud.com", "zlhades@hotmail.com"]

# 自动回复标记（包含这些的消息会被忽略）
AUTO_MARKERS = ["✅", "📊", "❌", "🚀", "👋", "[自动]", "执行完成", "收到："]

def log(msg):
    t = datetime.now().strftime('%H:%M:%S')
    line = f"[{t}] {msg}"
    print(line)
    open(LOG, 'a').write(line + "\n")

def send_imessage(contact, msg):
    """发送 iMessage"""
    log(f"📤 发送到 {contact}: {msg[:50]}...")
    clean = msg.replace('"', '\\"').replace('\n', ' ')
    result = subprocess.run([
        'osascript',
        '-e', 'tell application "Messages"',
        '-e', f'send "{clean}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
        '-e', 'end tell'
    ], capture_output=True, text=True)
    if result.returncode == 0:
        log(f"✅ 发送成功")
        return True
    log(f"❌ 失败：{result.stderr[:100]}")
    return False

def get_last_message():
    """
    获取最新消息 - 严格防死循环
    
    关键：只获取 is_from_me=0 的消息（别人发来的）
    这样自己发送的 Summary 回复（is_from_me=1）绝对不会被处理
    """
    if not os.path.exists(DB):
        return None, None
    
    conn = sqlite3.connect(DB)
    c = conn.cursor()
    ph = ','.join('?' * len(CONTACTS))
    
    # 严格：只获取 is_from_me=0 的消息
    c.execute(f"""
        SELECT m.text, m.is_from_me, h.id as contact
        FROM message m
        JOIN handle h ON m.handle_id = h.rowid
        WHERE h.id IN ({ph})
          AND m.text IS NOT NULL 
          AND m.text != ''
          AND m.is_from_me = 0
        ORDER BY m.date DESC 
        LIMIT 1
    """, CONTACTS)
    
    r = c.fetchone()
    conn.close()
    
    if r and r[0]:
        text = r[0]
        # 双重检查：即使数据库有误，也忽略包含标记的消息
        if any(marker in text for marker in AUTO_MARKERS):
            log(f"⚠️ 忽略自动回复：{text[:30]}...")
            return None, None
        return (text, r[2])
    
    return (None, None)

def inject(text):
    """注入到 tmux"""
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log("❌ tmux 无")
        return False
    
    log(f"🎯 注入：{text[:40]}...")
    # 清理输入框
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'C-c'], capture_output=True)
    time.sleep(0.2)
    # 注入消息
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, text, 'Enter'], capture_output=True)
    time.sleep(0.5)
    log(f"✅ 已发送")
    return True

def get_qwen_output():
    """获取 Qwen 输出"""
    result = subprocess.run(['tmux', 'capture-pane', '-t', TMUX, '-p'], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else ""

def check_execution_complete():
    """检查执行完成"""
    output = get_qwen_output()
    markers = ["执行完成", "已完成", "Finished", "Done", "Would you like", "还有什么", "╰─", "└──"]
    return any(m in output for m in markers)

def main():
    log("╔═══════════════════════════════════╗")
    log("║  v9 - 严格防死循环版               ║")
    log("╚═══════════════════════════════════╝")
    
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log(f"❌ tmux '{TMUX}' 无")
        sys.exit(1)
    
    log(f"📱 监听：{', '.join(CONTACTS)}")
    log(f"🎯 tmux: {TMUX}")
    log(f"🛡️  防死循环：严格模式 (只监听 is_from_me=0)")
    
    done = set()
    if os.path.exists(DONE):
        done = set(open(DONE).read().strip().split('\n'))
    
    last_msg, _ = get_last_message()
    log(f"✅ 开始")
    
    n = 0
    pending = None
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
                        # 发送确认（带标记，不会被再次处理）
                        send_imessage(contact, f"✅ 收到：{msg[:30]}...")
                        pending = msg
                        pending_contact = contact
                        start_time = time.time()
                        done.add(msg)
                        open(DONE, 'w').write('\n'.join(done))
                last_msg = msg
            
            # 2. 检查执行完成并发送 Summary
            if pending and start_time and (time.time() - start_time) > 10:
                if check_execution_complete():
                    log(f"✅ 执行完成，发送 Summary")
                    output = get_qwen_output()
                    if len(output) > 300:
                        output = output[:300] + "..."
                    summary = f"📊 执行完成\n\n指令：{pending[:50]}\n\n结果：{output}"
                    send_imessage(pending_contact, summary)
                    pending = None
                    start_time = None
                elif (time.time() - start_time) > 60:  # 超时
                    log(f"⏱️ 超时，发送超时通知")
                    send_imessage(pending_contact, f"⏱️ 执行超时，请检查 Qwen 状态")
                    pending = None
                    start_time = None
            
            time.sleep(3)
    
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")

if __name__ == "__main__":
    main()
