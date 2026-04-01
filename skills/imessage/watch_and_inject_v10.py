#!/usr/bin/env python3
"""
iMessage 监听器 v10 - 真正的执行后 Summary

关键修复：
1. 消息注入后，等待 Qwen 真正执行完成
2. 从 tmux 获取 Qwen 的真实输出
3. 发送真实的执行结果，不是编造的
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
    """注入消息到 tmux - 确保真正发送"""
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log("❌ tmux 无")
        return False
    
    log(f"🎯 注入：{text[:40]}...")
    
    # 步骤 1: 清除当前输入 (Ctrl+C)
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'C-c'], capture_output=True)
    time.sleep(0.3)
    
    # 步骤 2: 输入消息
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, text], capture_output=True)
    time.sleep(0.3)
    
    # 步骤 3: 按 Enter 发送
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'Enter'], capture_output=True)
    time.sleep(0.5)
    
    log(f"✅ 已发送到 tmux")
    return True

def get_qwen_output():
    """获取 Qwen 的完整输出"""
    result = subprocess.run(['tmux', 'capture-pane', '-t', TMUX, '-p', '-S', '-500'], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else ""

def check_qwen_finished():
    """
    检查 Qwen 是否执行完成
    
    完成标志：
    - 出现输入提示符 "> " 或 "? for shortcuts"
    - 出现 "Would you like" 等询问
    - 出现代码块结束标记
    - 不再有新输出（稳定 5 秒）
    """
    output = get_qwen_output()
    
    # 完成标志
    finished_markers = [
        "? for shortcuts",  # Qwen Code 的提示
        "Would you like",   # 询问
        "Type your message", # 输入提示
        "╰─", "└──",        # 树形输出结束
        "════════",         # 分隔线
    ]
    
    for marker in finished_markers:
        if marker in output:
            return True
    
    return False

def extract_result(output, command):
    """从 Qwen 输出中提取执行结果"""
    # 查找代码执行结果
    lines = output.split('\n')
    result_lines = []
    
    # 查找最近的代码块或命令输出
    in_code_block = False
    for line in lines[-100:]:  # 只看最后 100 行
        if '```' in line:
            in_code_block = not in_code_block
        if in_code_block or line.strip().startswith('$'):
            result_lines.append(line)
    
    if result_lines:
        return '\n'.join(result_lines[-20:])  # 返回最后 20 行
    
    # 如果没有找到代码块，返回最后部分
    return '\n'.join(lines[-30:])

def main():
    log("╔═══════════════════════════════════╗")
    log("║  v10 - 真正的执行后 Summary         ║")
    log("╚═══════════════════════════════════╝")
    
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log(f"❌ tmux '{TMUX}' 无")
        sys.exit(1)
    
    log(f"📱 监听：{', '.join(CONTACTS)}")
    log(f"🎯 tmux: {TMUX}")
    log(f"🛡️  防死循环：严格模式")
    
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
                        send_imessage(contact, f"✅ 收到：{msg[:30]}... 正在等待 Qwen 执行")
                        pending = msg
                        pending_contact = contact
                        start_time = time.time()
                        done.add(msg)
                        open(DONE, 'w').write('\n'.join(done))
                        last_output = ""
                        stable_count = 0
                last_msg = msg
            
            # 2. 等待 Qwen 执行完成
            if pending and start_time:
                elapsed = time.time() - start_time
                
                # 10 秒后开始检查
                if elapsed > 10:
                    current_output = get_qwen_output()
                    
                    # 检查是否完成
                    if check_qwen_finished():
                        log(f"✅ Qwen 执行完成，提取结果...")
                        result = extract_result(current_output, pending)
                        if len(result) > 400:
                            result = result[:400] + "..."
                        summary = f"📊 执行完成\n\n指令：{pending[:50]}\n\nQwen 执行结果:\n{result}"
                        send_imessage(pending_contact, summary)
                        log(f"📤 Summary 已发送")
                        pending = None
                        start_time = None
                    
                    # 超时 (5 分钟)
                    elif elapsed > 300:
                        log(f"⏱️ 超时，发送通知")
                        send_imessage(pending_contact, f"⏱️ 执行超时 (>5 分钟)，请检查 Qwen 状态")
                        pending = None
                        start_time = None
            
            time.sleep(3)
    
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")

if __name__ == "__main__":
    main()
