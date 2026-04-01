#!/usr/bin/env python3
"""
iMessage 监听器 v3 - 带日志输出

用法：
    python3 imessage-watcher-v3.py [联系人] [间隔秒数]
"""

import json
import subprocess
import sys
import time
import os
from datetime import datetime
import sqlite3

CONTACT = sys.argv[1] if len(sys.argv) > 1 else "zlhades@icloud.com"
INTERVAL = int(sys.argv[2]) if len(sys.argv) > 2 else 5

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")
LOG_FILE = "/tmp/imessage-watcher.log"


def log(message):
    """写入日志"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    log_msg = f"[{timestamp}] {message}"
    print(log_msg)
    with open(LOG_FILE, 'a') as f:
        f.write(log_msg + "\n")
        f.flush()


def get_last_message_from_db():
    """直接从数据库读取最新消息"""
    if not os.path.exists(CHAT_DB_PATH):
        return None, 0
    
    conn = sqlite3.connect(CHAT_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = """
    SELECT m.rowid, m.text, m.date, m.is_from_me, h.id as handle_id
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.rowid
    WHERE h.id = ?
    ORDER BY m.date DESC
    LIMIT 1
    """
    
    cursor.execute(query, (CONTACT,))
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


def execute_message(message):
    """执行消息中的指令"""
    text = message.get('text', '')
    
    log(f"📱 新消息内容：{text}")
    log("\n🔍 分析并执行中...\n")
    
    prompt = f"""请执行这条 iMessage 消息中的指令：

【消息】
{text}

【任务】
1. 识别可执行指令
2. 执行任务
3. 返回结果

请开始："""

    result = subprocess.run(
        ["qwen", "-p", prompt, "-y"],
        capture_output=True,
        text=True,
        timeout=120
    )
    
    output = result.stdout
    log(f"\n✅ 执行结果:\n{output}")
    log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    # 写入日志文件
    with open(LOG_FILE, 'a') as f:
        f.write(f"执行结果:\n{output}\n")
        f.write("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
        f.flush()


# ============== 主程序 ==============

log("╔═══════════════════════════════════════════════════════════╗")
log("║        iMessage 监听器 v3 - 带日志输出                     ║")
log("╚═══════════════════════════════════════════════════════════╝")
log("")
log(f"📱 监听联系人：{CONTACT}")
log(f"⏱️  检查间隔：{INTERVAL} 秒")
log(f"📅 开始时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
log(f"📄 日志文件：{LOG_FILE}")
log("")
log("按 Ctrl+C 停止监听")
log("")
log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

# 获取初始消息 ID
_, last_id = get_last_message_from_db()
log(f"✅ 初始消息 ID: {last_id}")
log(f"🕐 开始监听...\n")

try:
    while True:
        message, current_id = get_last_message_from_db()
        
        if current_id != last_id and current_id != 0:
            # 发现新消息！
            log(f"\n🔔 发现新消息 (ID: {current_id})")
            
            if message and message.get('text') != '[无内容]':
                execute_message(message)
                # 回复 "yes"
                log("📤 回复：yes")
            else:
                log("⚠️ 消息无内容，跳过")
            
            last_id = current_id
        else:
            # 无新消息
            log(f"🕐 无新消息 (当前 ID: {current_id})")
        
        time.sleep(INTERVAL)

except KeyboardInterrupt:
    log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log("👋 监听已停止")
    log(f"📅 结束时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
