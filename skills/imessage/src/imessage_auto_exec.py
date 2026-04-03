#!/usr/bin/env python3
"""
iMessage Auto-Exec Module

持续监听 iMessage 数据库，检测到新消息时自动执行命令并回复结果。
支持简单命令模式匹配（运行/执行/run）和 AI 调用模式。
"""

import sqlite3
import os
import time
import subprocess
import re
from datetime import datetime

# ============== 配置 ==============
CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")
LOG_FILE = "/tmp/imessage-auto-exec.log"
CONTACT_FILTERS = ["zlhades@icloud.com", "zlhades@hotmail.com"]
REPLY_TO = "zlhades@icloud.com"
CHECK_INTERVAL = 3

# 导入回复模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imessage_reply import send_summary, send_detailed_summary, send_quick_reply, send_error_notification


def log(message: str):
    """写入日志"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    log_msg = f"[{timestamp}] {message}"
    print(log_msg)
    with open(LOG_FILE, 'a') as f:
        f.write(log_msg + "\n")
        f.flush()


def get_last_message():
    """从数据库读取最新消息（所有监听的联系人）"""
    if not os.path.exists(CHAT_DB_PATH):
        return None, 0

    conn = sqlite3.connect(CHAT_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    placeholders = ','.join('?' * len(CONTACT_FILTERS))
    query = f"""
        SELECT m.rowid, m.text, m.date, m.is_from_me, h.id as handle_id
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.rowid
        WHERE h.id IN ({placeholders})
        ORDER BY m.date DESC
        LIMIT 1
    """

    cursor.execute(query, CONTACT_FILTERS)
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None, 0

    return {
        'id': row['rowid'],
        'text': row['text'] if row['text'] else '[无内容]',
        'date': row['date'],
        'is_from_me': bool(row['is_from_me']),
        'handle': row['handle_id']
    }, row['rowid']


def execute_simple_command(text: str, contact: str = None):
    """执行简单的 shell 命令（匹配 运行/执行/run 模式）"""
    patterns = [
        r'运行 (.+)', r'执行 (.+)', r'run (.+)',
        r'create file (.+)', r'创建文件 (.+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            command = match.group(1).strip()
            log(f"🔧 执行命令：{command}")

            if contact:
                send_quick_reply(contact, "📥 收到指令，正在执行...")

            start_time = time.time()
            try:
                result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
                output = result.stdout or result.stderr or "命令已执行"
                duration = time.time() - start_time
                log(f"✅ 执行结果：{output}")

                if contact:
                    send_summary(contact=contact, original_message=text, execution_result=output, success=True)
                return output

            except subprocess.TimeoutExpired:
                log(f"⏰ 执行超时")
                if contact:
                    send_error_notification(contact, "命令执行超时（超过 30 秒）", text)
                return "执行超时"
            except Exception as e:
                log(f"❌ 执行失败：{e}")
                if contact:
                    send_error_notification(contact, str(e), text)
                return f"执行失败：{e}"

    return None


def send_notification(title: str, message: str):
    """发送桌面通知"""
    try:
        subprocess.run(['osascript', '-e', f'display notification "{message}" with title "{title}"'])
        log(f"🔔 通知：{title} - {message}")
    except Exception as e:
        log(f"⚠️ 通知失败：{e}")


# ============== 主程序 ==============

def main():
    log("╔══════════════════════════════════════════════╗")
    log("║     iMessage 自动监听器                       ║")
    log("╚══════════════════════════════════════════════╝")
    log(f"📱 监听：{', '.join(CONTACT_FILTERS)}")
    log(f"⏱️  间隔：{CHECK_INTERVAL}秒 | 📄 日志：{LOG_FILE}")

    _, last_id = get_last_message()
    log(f"✅ 初始消息 ID: {last_id} | 开始监听...")

    exec_count = 0

    try:
        while True:
            message, current_id = get_last_message()

            if current_id != last_id and current_id != 0:
                log(f"\n🔔 新消息 (ID: {current_id}) from {message['handle']}")
                log(f"📱 {message['text'][:100]}...")

                result = execute_simple_command(message['text'], contact=REPLY_TO)

                if result:
                    send_notification("指令执行完成", f"已执行：{message['text'][:50]}")
                    exec_count += 1
                else:
                    log("ℹ️ 不包含可执行命令")
                    send_notification("收到 iMessage", message['text'][:100])
                    # 简单自动回复
                    if any(kw in message['text'] for kw in ["回答 yes", "回复 yes", "回复一下"]):
                        send_quick_reply(REPLY_TO, "yes")
                    elif "测试" in message['text']:
                        send_quick_reply(REPLY_TO, "✅ 监听器正常工作")

                last_id = current_id

            exec_count += 1
            time.sleep(CHECK_INTERVAL)

    except KeyboardInterrupt:
        log(f"\n👋 已停止 (共 {exec_count} 次检查)")


if __name__ == "__main__":
    main()
