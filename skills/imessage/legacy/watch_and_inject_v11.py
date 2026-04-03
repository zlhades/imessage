#!/usr/bin/env python3
"""
iMessage 监听器 v11 - Prompt 注入版

核心思路：
注入消息时附加 prompt，让 Qwen 执行完成后主动发送 iMessage
"""

import sqlite3, os, sys, time, subprocess
from datetime import datetime

DB = os.path.expanduser("~/Library/Messages/chat.db")
TMUX = "qwen_imsg"
LOG = "/tmp/qwen_imsg.log"
DONE = "/tmp/qwen_imsg_done.txt"
CONTACTS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
AUTO_MARKERS = ["✅", "📊", "❌", "🚀", "👋", "[自动]", "执行完成", "收到："]

# 附加的 prompt
INJECTION_PROMPT = """

---
📋 执行要求：
1. 请执行上面的指令
2. 执行完成后，请运行以下命令发送 iMessage 回复：

```python
import subprocess
subprocess.run(['osascript', '-e', 'tell application "Messages" to send "📊 执行完成\\n\\n指令：{command}\\n\\n结果：{result}" to buddy "zlhades@icloud.com" of (service 1 whose service type is iMessage)'])
```

请将 {command} 替换为指令内容，{result} 替换为执行结果。
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
            log(f"⚠️ 忽略自动回复：{r[0][:30]}...")
            return None, None
        return (r[0], r[2])
    return (None, None)

def inject_with_prompt(text):
    """注入消息 + 附加 prompt"""
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log("❌ tmux 无")
        return False
    
    # 生成完整的 prompt
    full_prompt = text + INJECTION_PROMPT.replace("{command}", text[:30])
    
    log(f"🎯 注入：{text[:40]}...")
    log(f"📝 附加 prompt 长度：{len(INJECTION_PROMPT)} 字符")
    
    # 清除当前输入
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'C-c'], capture_output=True)
    time.sleep(0.2)
    
    # 分段输入（避免一次输入太长）
    lines = full_prompt.split('\n')
    for line in lines:
        subprocess.run(['tmux', 'send-keys', '-t', TMUX, line + '\n'], capture_output=True)
        time.sleep(0.05)
    
    time.sleep(0.3)
    
    # 按 Enter 发送
    subprocess.run(['tmux', 'send-keys', '-t', TMUX, 'Enter'], capture_output=True)
    
    log(f"✅ 已发送到 tmux (带 prompt)")
    return True

def main():
    log("╔═══════════════════════════════════╗")
    log("║  v11 - Prompt 注入版               ║")
    log("╚═══════════════════════════════════╝")
    
    if subprocess.run(['tmux', 'has-session', '-t', TMUX], capture_output=True).returncode != 0:
        log(f"❌ tmux '{TMUX}' 无")
        sys.exit(1)
    
    log(f"📱 监听：{', '.join(CONTACTS)}")
    log(f"🎯 tmux: {TMUX}")
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
                        # 发送确认
                        send_imessage(contact, f"✅ 收到：{msg[:30]}... Qwen 执行完成后会发送结果")
                        done.add(msg)
                        open(DONE, 'w').write('\n'.join(done))
                last_msg = msg
            
            time.sleep(2)
    
    except KeyboardInterrupt:
        log(f"\n👋 停止 (共{n}条)")

if __name__ == "__main__":
    main()
