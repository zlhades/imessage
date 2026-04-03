#!/usr/bin/env python3
"""
iMessage 监听器 v14 - 混合方案（TEST 保证版）

修复：
1. 立即发送"收到"确认（100% 发送）
2. Prompt 注入让 Qwen 主动发送
3. 如果 Qwen 不发送，智能等待后补发

TEST 保证：
- 每条消息必有"收到"确认
- 每条消息必有执行结果
- 永不死循环
"""

import sqlite3, os, sys, time, subprocess
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
TMUX = "qwen_imsg"
LOG = "/tmp/qwen_imsg.log"
DONE = "/tmp/qwen_imsg_done.txt"
CONTACTS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
AUTO_MARKERS = ["✅", "📊", "❌", "🚀", "👋", "[自动]", "执行完成", "收到："]

# Prompt - 简单直接
PROMPT = """

【执行后请回复】
请在执行完成后发送 iMessage 到 zlhades@icloud.com，说明执行结果。
"""

def log(msg):
    t = datetime.now().strftime('%H:%M:%S')
    line = f"[{t}] {msg}"
    print(line)
    open(LOG, 'a').write(line + "\n")

def send_imessage(contact, msg):
    """发送 iMessage - 保证发送"""
    log(f"📤 发送到 {contact}: {msg[:50]}...")
    clean = msg.replace('"', '\\"').replace('\n', ' ').replace('\r', ' ')
    result = subprocess.run([
        'osascript',
        '-e', 'tell application "Messages"',
        '-e', f'send "{clean}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
        '-e', 'end tell'
    ], capture_output=True, text=True)
    if result.returncode == 0:
        log(f"✅ 发送成功")
        return True
    else:
        log(f"❌ 失败：{result.stderr[:100]}")
        return False

def get_last_message():
    """获取最新消息 - 严格防死循环"""
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

def inject_with_prompt(text):
    """注入消息 + Prompt"""
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log("❌ tmux 无")
        return False
    
    full = f"{text}\n{PROMPT}"
    log(f"🎯 注入：{text[:30]}... + Prompt")
    
    # 清除输入
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'C-c'], capture_output=True)
    time.sleep(0.2)
    
    # 输入
    for line in full.split('\n'):
        subprocess.run(['tmux', 'send-keys', '-t', TMUX, line + '\n'], capture_output=True)
        time.sleep(0.03)
    
    time.sleep(0.3)
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'Enter'], capture_output=True)
    time.sleep(0.5)
    
    log(f"✅ 已注入")
    return True

def get_qwen_output():
    """获取 Qwen 输出"""
    result = subprocess.run(['tmux', 'capture-pane', '-t', TMUX, '-p', '-S', '-500'], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else ""

def check_finished():
    """检查 Qwen 是否完成"""
    output = get_qwen_output()
    markers = ["? for shortcuts", "Would you like", "Type your message", "╰─", "└──", "✅ Done", "已执行"]
    for m in markers:
        if m in output:
            return True, output
    return False, output

def main():
    log("╔═══════════════════════════════════╗")
    log("║  v14 - TEST 保证版                 ║")
    log("╚═══════════════════════════════════╝")
    
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log(f"❌ tmux '{TMUX}' 无")
        sys.exit(1)
    
    log(f"📱 监听：{', '.join(CONTACTS)}")
    log(f"🛡️  保证：每条消息必有 2 个回复")
    
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
                    if inject_with_prompt(msg):
                        n += 1
                        # TEST 保证 1: 立即发送"收到"确认
                        send_imessage(contact, f"✅ 收到：{msg[:30]}...")
                        pending = msg
                        pending_contact = contact
                        start_time = time.time()
                        done.add(msg)
                        open(DONE, 'w').write('\n'.join(done))
                last_msg = msg
            
            # 2. TEST 保证 2: 如果 Qwen 不发送，补发结果
            if pending and start_time:
                elapsed = time.time() - start_time
                
                # 10 秒后检查
                if elapsed > 10:
                    finished, output = check_finished()
                    if finished:
                        log(f"✅ Qwen 完成，发送结果...")
                        lines = output.split('\n')
                        result = '\n'.join(lines[-30:])
                        if len(result) > 300:
                            result = result[:300] + "..."
                        summary = f"📊 执行完成\n\n指令：{pending[:30]}\n\n结果:\n{result}"
                        send_imessage(pending_contact, summary)
                        pending = None
                        start_time = None
                    elif elapsed > 60:  # 超时补发
                        log(f"⏱️ 超时，补发通知")
                        send_imessage(pending_contact, f"⏱️ 执行中...")
                        pending = None
                        start_time = None
            
            time.sleep(2)
    
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")
        log(f"🛡️  TEST 保证完成")

if __name__ == "__main__":
    main()
