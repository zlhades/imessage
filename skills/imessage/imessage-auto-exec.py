#!/usr/bin/env python3
"""
iMessage 自动监听器 - 独立运行，带自动回复

功能：
1. 持续监听 iMessage 数据库
2. 检测到新消息时自动执行简单命令
3. 发送桌面通知
4. 写入执行日志
5. ✅ 自动发送 Summary 回复到 iMessage（闭环）
"""

import sqlite3
import os
import time
import subprocess
from datetime import datetime
import re

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")
LOG_FILE = "/tmp/imessage-auto-exec.log"
CONTACT_FILTERS = ["zlhades@icloud.com", "zlhades@hotmail.com"]  # 监听的联系人列表
REPLY_TO = "zlhades@icloud.com"  # 统一回复到这个邮箱（无论消息发到哪个）
CHECK_INTERVAL = 3  # 检查间隔（秒）

# 导入自动回复模块
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
from imessage-reply import send_summary, send_detailed_summary, send_quick_reply, send_error_notification


def log(message):
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
    
    # 为每个联系人创建 WHERE 条件
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
    
    text = row['text'] if row['text'] else '[无内容]'
    
    return {
        'id': row['rowid'],
        'text': text,
        'date': row['date'],
        'is_from_me': bool(row['is_from_me']),
        'handle': row['handle_id']
    }, row['rowid']


def execute_simple_command(text, contact=None):
    """执行简单的 shell 命令，并发送 Summary"""
    start_time = time.time()
    
    # 匹配 "运行 xxx" 或 "执行 xxx" 或 "run xxx"
    patterns = [
        r'运行 (.+)',
        r'执行 (.+)',
        r'run (.+)',
        r'create file (.+)',
        r'创建文件 (.+)',
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            command = match.group(1).strip()
            log(f"🔧 执行命令：{command}")
            
            # 发送"收到"回复
            if contact:
                send_quick_reply(contact, "📥 收到指令，正在执行...")

            try:
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                output = result.stdout or result.stderr or "命令已执行"
                duration = time.time() - start_time
                log(f"✅ 执行结果：{output}")
                
                # 发送 Summary
                if contact:
                    send_summary(
                        contact=contact,
                        original_message=text,
                        execution_result=output,
                        success=True
                    )
                
                return output
            except subprocess.TimeoutExpired:
                duration = time.time() - start_time
                log(f"⏰ 执行超时")
                if contact:
                    send_error_notification(contact, "命令执行超时（超过 30 秒）", text)
                return "执行超时"
            except Exception as e:
                duration = time.time() - start_time
                log(f"❌ 执行失败：{e}")
                if contact:
                    send_error_notification(contact, str(e), text)
                return f"执行失败：{e}"

    return None


def send_notification(title, message):
    """发送桌面通知"""
    try:
        subprocess.run([
            'osascript',
            '-e', f'display notification "{message}" with title "{title}"'
        ])
        log(f"🔔 通知：{title} - {message}")
    except Exception as e:
        log(f"⚠️ 通知失败：{e}")


def send_imessage_reply(contact, message):
    """发送 iMessage 回复"""
    try:
        subprocess.run([
            'osascript',
            '-e', 'tell application "Messages"',
            '-e', f'send "{message}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
            '-e', 'end tell'
        ], check=True)
        log(f"📤 回复 iMessage: {contact} - {message}")
    except Exception as e:
        log(f"❌ 回复失败：{e}")


# ============== 主程序 ==============

def main():
    log("╔═══════════════════════════════════════════════════════════╗")
    log("║     iMessage 自动监听器 - 独立运行版                       ║")
    log("╚═══════════════════════════════════════════════════════════╝")
    log("")
    log(f"📱 监听联系人：{', '.join(CONTACT_FILTERS)}")
    log(f"⏱️  检查间隔：{CHECK_INTERVAL} 秒")
    log(f"📄 日志文件：{LOG_FILE}")
    log("")
    
    # 获取初始消息 ID
    _, last_id = get_last_message()
    log(f"✅ 初始消息 ID: {last_id}")
    log("🕐 开始监听... (按 Ctrl+C 停止)")
    log("")
    
    exec_count = 0
    
    try:
        while True:
            message, current_id = get_last_message()

            if current_id != last_id and current_id != 0:
                # 发现新消息！
                log(f"\n🔔 发现新消息 (ID: {current_id})")
                log(f"📱 内容：{message['text'][:100]}...")
                log(f"📩 来自：{message['handle']}")
                log(f"📤 回复到：{REPLY_TO}")

                # 尝试执行简单命令（传递统一回复邮箱）
                result = execute_simple_command(message['text'], contact=REPLY_TO)

                if result:
                    # 有执行结果，发送通知（iMessage 回复已自动发送）
                    send_notification("iMessage 指令执行完成", f"已执行：{message['text'][:50]}")
                    exec_count += 1
                else:
                    # 没有可执行的命令，发送通知
                    log("ℹ️ 消息不包含可执行命令")
                    send_notification("收到 iMessage", message['text'][:100])
                    # 检查是否需要回复
                    if "回答 yes" in message['text'] or "回复 yes" in message['text'] or "回复一下" in message['text']:
                        send_imessage_reply(REPLY_TO, "yes")
                        log("📤 自动回复：yes")
                    elif "测试" in message['text']:
                        send_imessage_reply(REPLY_TO, "✅ 收到测试消息！监听器正常工作。")
                        log("📤 自动回复：✅ 收到测试消息！")

                last_id = current_id
            else:
                # 无新消息
                if exec_count % 10 == 0:  # 每 10 次无消息输出一次状态
                    log(f"🕐 无新消息 (检查 {exec_count + 1} 次)")

            exec_count += 1
            time.sleep(CHECK_INTERVAL)
    
    except KeyboardInterrupt:
        log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        log("👋 监听已停止")
        log(f"📊 共处理 {exec_count} 次检查")
        log(f"📅 结束时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


if __name__ == "__main__":
    main()
