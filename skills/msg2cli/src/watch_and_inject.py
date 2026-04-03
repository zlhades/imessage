#!/usr/bin/env python3
"""
iMessage Watch & Inject Module

监听 iMessage 新消息，自动注入到 tmux 会话中的 AI 终端执行，
并通过 AppleScript 发送执行结果回复。
"""

import sqlite3
import os
import sys
import time
import subprocess
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
LOG = "/tmp/qwen_imsg.log"
DONE = "/tmp/qwen_imsg_done.txt"
CONTACTS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
AUTO_MARKERS = ["✅", "📊", "❌", "🚀", "👋", "[自动]", "执行完成", "收到："]

# AI 执行后自动回复的 Prompt 后缀
EXECUTE_PROMPT = "\n\n【执行后请回复】\n请在执行完成后发送 iMessage 到 zlhades@icloud.com，说明执行结果。"


def log(msg: str):
    t = datetime.now().strftime('%H:%M:%S')
    line = f"[{t}] {msg}"
    print(line)
    with open(LOG, 'a') as f:
        f.write(line + "\n")


def send_imessage(contact: str, msg: str) -> bool:
    """发送 iMessage"""
    log(f"📤 发送到 {contact}: {msg[:50]}...")
    clean = msg.replace('"', '\\"').replace('\n', ' ').replace('\r', ' ')
    result = subprocess.run([
        'osascript',
        '-e', 'tell application "Messages"',
        '-e', f'send "{clean}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
        '-e', 'end tell'
    ], capture_output=True, text=True)

    if result.returncode == 0:
        log("✅ 发送成功")
        return True
    else:
        log(f"❌ 失败：{result.stderr[:100]}")
        return False


def get_last_message():
    """获取最新消息（严格防死循环：只处理 is_from_me=0 且非自动消息）"""
    if not os.path.exists(DB):
        return None, None
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


def inject_to_tmux(session: str, text: str) -> bool:
    """注入消息到 tmux 会话"""
    if subprocess.run(['tmux', 'has-session', '-t', session], capture_output=True).returncode != 0:
        log(f"❌ tmux 会话 '{session}' 不存在")
        return False

    full = f"{text}{EXECUTE_PROMPT}"
    log(f"🎯 注入：{text[:30]}... + Prompt")

    # 清除当前输入
    subprocess.run(['tmux', 'send-keys', '-t', session, 'C-c'], capture_output=True)
    time.sleep(0.2)

    # 逐行输入
    for line in full.split('\n'):
        subprocess.run(['tmux', 'send-keys', '-t', session, line + '\n'], capture_output=True)
        time.sleep(0.03)

    time.sleep(0.3)
    subprocess.run(['tmux', 'send-keys', '-t', session, 'Enter'], capture_output=True)
    log("✅ 已注入")
    return True


def get_ai_output(session: str) -> str:
    """获取 AI 终端输出"""
    result = subprocess.run(
        ['tmux', 'capture-pane', '-t', session, '-p', '-S', '-500'],
        capture_output=True, text=True
    )
    return result.stdout if result.returncode == 0 else ""


def check_ai_finished(session: str) -> tuple:
    """检查 AI 是否完成执行"""
    output = get_ai_output(session)
    markers = ["? for shortcuts", "Would you like", "Type your message", "╰─", "└──", "✅ Done", "已执行"]
    for m in markers:
        if m in output:
            return True, output
    return False, output


def main():
    tmux_session = "qwen_imsg"

    log("╔═══════════════════════════════════╗")
    log("║  iMessage Watch & Inject           ║")
    log("╚═══════════════════════════════════╝")

    if subprocess.run(['tmux', 'has-session', '-t', tmux_session], capture_output=True).returncode != 0:
        log(f"❌ tmux '{tmux_session}' 不存在")
        sys.exit(1)

    log(f"📱 监听：{', '.join(CONTACTS)}")

    done = set()
    if os.path.exists(DONE):
        done = set(open(DONE).read().strip().split('\n'))

    last_msg, _ = get_last_message()
    log("✅ 开始监听")

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
                    if inject_to_tmux(tmux_session, msg):
                        n += 1
                        send_imessage(contact, f"✅ 收到：{msg[:30]}...")
                        pending = msg
                        pending_contact = contact
                        start_time = time.time()
                        done.add(msg)
                        open(DONE, 'w').write('\n'.join(done))
                last_msg = msg

            # 2. 检查 AI 是否完成，超时补发
            if pending and start_time:
                elapsed = time.time() - start_time
                if elapsed > 10:
                    finished, output = check_ai_finished(tmux_session)
                    if finished:
                        log("✅ AI 完成，发送结果...")
                        lines = output.split('\n')
                        result = '\n'.join(lines[-30:])
                        if len(result) > 300:
                            result = result[:300] + "..."
                        summary = f"📊 执行完成\n\n指令：{pending[:30]}\n\n结果:\n{result}"
                        send_imessage(pending_contact, summary)
                        pending = None
                        start_time = None
                    elif elapsed > 60:
                        log("⏱️ 超时，补发通知")
                        send_imessage(pending_contact, "⏱️ 执行中...")
                        pending = None
                        start_time = None

            time.sleep(2)

    except KeyboardInterrupt:
        log(f"\n👋 已停止 (共 {n} 条)")


if __name__ == "__main__":
    main()
