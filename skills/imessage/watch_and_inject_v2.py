#!/usr/bin/env python3
"""
watch_and_inject.py v2 - 修复中文和注入问题

功能：
1. 正确读取中文消息（从 attributedBody）
2. 正确注入到 tmux 会话
3. 记录已处理的消息 ID
"""

import sqlite3
import os
import sys
import time
import subprocess
from datetime import datetime
import plistlib
import re

# ============== 配置 ==============

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")
PROCESSED_FILE = "/tmp/qwen_imsg_processed.txt"
TMUX_SESSION = "qwen_imsg"

CONTACT_FILTERS = [
    "zlhades@icloud.com",
    "zlhades@hotmail.com",
]

CHECK_INTERVAL = 3
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


def extract_text_from_attributed_body(blob):
    """从 attributedBody BLOB 中提取文本（支持中文）"""
    if not blob:
        return None
    
    try:
        # 尝试解析为 plist
        plist_data = plistlib.loads(blob)
        
        # 递归查找 NS.string 内容
        def find_ns_string(obj):
            if isinstance(obj, dict):
                if 'NS.string' in obj:
                    return obj['NS.string']
                for value in obj.values():
                    result = find_ns_string(value)
                    if result:
                        return result
            elif isinstance(obj, list):
                for item in obj:
                    result = find_ns_string(item)
                    if result:
                        return result
            return None
        
        text = find_ns_string(plist_data)
        if text and text.strip():
            return text
    except Exception as e:
        pass
    
    return None


def get_last_message():
    """从数据库读取最新消息（支持中文）"""
    if not os.path.exists(CHAT_DB_PATH):
        log(f"❌ 错误：找不到 iMessage 数据库 {CHAT_DB_PATH}")
        return None, 0
    
    conn = sqlite3.connect(CHAT_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    placeholders = ','.join('?' * len(CONTACT_FILTERS))
    query = f"""
    SELECT m.rowid, m.text, m.attributedBody, m.date, m.is_from_me, h.id as handle_id
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
    
    # 优先从 text 字段获取，如果没有则从 attributedBody 提取
    text = row['text']
    if not text or not text.strip():
        text = extract_text_from_attributed_body(row['attributedBody'])
    
    if not text:
        text = '[无内容]'
    
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
    # 检查 tmux 会话
    if not check_tmux_session():
        log(f"❌ tmux 会话 '{TMUX_SESSION}' 不存在")
        return False
    
    # 清理消息内容，移除特殊字符
    clean_text = text.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
    
    # 使用 tmux send-keys 注入
    log(f"🎯 注入内容：{clean_text[:50]}...")
    
    result = subprocess.run(
        ['tmux', 'send-keys', '-t', TMUX_SESSION, clean_text, 'Enter'],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        log(f"❌ 注入失败：{result.stderr}")
        return False
    
    log(f"✅ 注入成功")
    
    # 验证注入
    sleep_result = subprocess.run(['sleep', '1'], capture_output=True)
    pane_content = subprocess.run(
        ['tmux', 'capture-pane', '-t', TMUX_SESSION, '-p'],
        capture_output=True,
        text=True
    )
    
    if text.strip() in pane_content.stdout[-200:]:
        log(f"✅ 验证成功：消息已显示在 tmux 中")
    else:
        log(f"⚠️ 验证：消息可能未完全显示")
    
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
    log("║     iMessage → tmux 注入监听器 v2 (修复版)                 ║")
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
                        else:
                            log("❌ 注入失败")
                    
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
