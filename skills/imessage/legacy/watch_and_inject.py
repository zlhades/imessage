#!/usr/bin/env python3
"""
watch_and_inject.py - iMessage 监听并注入到 tmux

功能：
1. 监听 iMessage 数据库
2. 检测新消息
3. 注入到 tmux 会话中的 Qwen CLI
"""

import sqlite3
import os
import sys
import time
import subprocess
from datetime import datetime

# ============== 配置 ==============

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")
PROCESSED_FILE = "/tmp/qwen_imsg_processed.txt"
TMUX_SESSION = "qwen_imsg"

# 监听的联系人（白名单）
CONTACT_FILTERS = [
    "zlhades@icloud.com",
    "zlhades@hotmail.com",
    # 添加你的 iPhone 号码，例如："+8613800138000"
]

CHECK_INTERVAL = 3  # 检查间隔（秒）
LOG_FILE = "/tmp/qwen_imsg_inject.log"

# ============== 工具函数 ==============

def log(message):
    """写入日志"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    log_msg = f"[{timestamp}] {message}"
    print(log_msg)
    with open(LOG_FILE, 'a') as f:
        f.write(log_msg + "\n")
        f.flush()


def get_processed_ids():
    """获取已处理的消息 ID 集合"""
    if not os.path.exists(PROCESSED_FILE):
        return set()
    
    with open(PROCESSED_FILE, 'r') as f:
        return set(line.strip() for line in f if line.strip())


def save_processed_id(msg_id):
    """保存已处理的消息 ID"""
    with open(PROCESSED_FILE, 'a') as f:
        f.write(f"{msg_id}\n")
        f.flush()


def get_last_message():
    """从数据库读取最新消息"""
    if not os.path.exists(CHAT_DB_PATH):
        log(f"❌ 错误：找不到 iMessage 数据库 {CHAT_DB_PATH}")
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


def check_tmux_session():
    """检查 tmux 会话是否存在"""
    result = subprocess.run(
        ['tmux', 'has-session', '-t', TMUX_SESSION],
        capture_output=True
    )
    return result.returncode == 0


def inject_to_tmux(text):
    """注入消息到 tmux 会话"""
    # 转义特殊字符
    escaped_text = text.replace("'", "'\"'\"'")
    
    # 使用 tmux send-keys 注入
    result = subprocess.run(
        ['tmux', 'send-keys', '-t', TMUX_SESSION, escaped_text, 'Enter'],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        log(f"❌ 注入失败：{result.stderr}")
        return False
    
    log(f"✅ 注入成功：{text[:50]}...")
    return True


def send_notification(title, message):
    """发送桌面通知"""
    try:
        subprocess.run([
            'osascript',
            '-e', f'display notification "{message}" with title "{title}"'
        ])
    except Exception as e:
        log(f"⚠️ 通知失败：{e}")


# ============== 主程序 ==============

def main():
    log("╔═══════════════════════════════════════════════════════════╗")
    log("║     iMessage → tmux 注入监听器                             ║")
    log("╚═══════════════════════════════════════════════════════════╝")
    log("")
    log(f"📱 监听联系人：{', '.join(CONTACT_FILTERS)}")
    log(f"⏱️  检查间隔：{CHECK_INTERVAL} 秒")
    log(f"📄 日志文件：{LOG_FILE}")
    log(f"💾 已处理记录：{PROCESSED_FILE}")
    log(f"🎯 tmux 会话：{TMUX_SESSION}")
    log("")
    
    # 检查 tmux 会话
    if not check_tmux_session():
        log(f"❌ 错误：tmux 会话 '{TMUX_SESSION}' 不存在")
        log(f"   请先运行：./start_qwen_tmux.sh")
        log("")
        log("退出程序。")
        sys.exit(1)
    
    log("✅ tmux 会话检查通过")
    
    # 获取已处理的消息 ID
    processed_ids = get_processed_ids()
    log(f"📋 已加载 {len(processed_ids)} 条已处理记录")
    
    # 获取初始消息 ID
    _, last_id = get_last_message()
    log(f"✅ 初始消息 ID: {last_id}")
    log("")
    log("🕐 开始监听... (按 Ctrl+C 停止)")
    log("")
    
    inject_count = 0
    
    try:
        while True:
            message, current_id = get_last_message()
            
            if current_id != last_id and current_id != 0:
                # 发现新消息！
                log(f"\n🔔 发现新消息 (ID: {current_id})")
                
                if current_id in processed_ids:
                    log("⚠️ 消息已处理过，跳过")
                else:
                    log(f"📱 来自：{message['handle']}")
                    log(f"💬 内容：{message['text'][:100]}...")
                    
                    # 检查 tmux 会话是否存在
                    if not check_tmux_session():
                        log(f"❌ 警告：tmux 会话 '{TMUX_SESSION}' 不存在，跳过注入")
                        send_notification("iMessage 监听器", "tmux 会话不存在，请检查")
                    else:
                        # 注入消息到 tmux
                        log("🎯 正在注入到 tmux...")
                        if inject_to_tmux(message['text']):
                            send_notification(
                                "iMessage 注入成功",
                                f"来自 {message['handle'][:20]}: {message['text'][:30]}"
                            )
                            inject_count += 1
                    
                    # 保存已处理 ID
                    save_processed_id(current_id)
                    processed_ids.add(current_id)
                
                last_id = current_id
            else:
                # 无新消息
                if inject_count % 10 == 0:
                    log(f"🕐 无新消息 (检查 {inject_count + 1} 次，已注入 {inject_count} 条)")
            
            time.sleep(CHECK_INTERVAL)
    
    except KeyboardInterrupt:
        log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        log("👋 监听已停止")
        log(f"📊 共处理 {inject_count} 次注入")
        log(f"📅 结束时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")


if __name__ == "__main__":
    main()
