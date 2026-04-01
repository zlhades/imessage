#!/usr/bin/env python3
"""
iMessage 持续监听工具 - 监听特定邮箱的消息

用法:
    python3 imessage_monitor.py
"""

import sqlite3
import os
import sys
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, List

# iMessage 时间戳纪元
IMESSAGE_EPOCH = datetime(2001, 1, 1)

# 要监听的邮箱列表
MONITOR_EMAILS = ["zlhades @icloud.com", "zlhades @hotmail.com"]

# 上次消息记录 (内存中)
last_message_time: Dict[str, int] = {}


def get_chat_db_path() -> str:
    """获取 iMessage 数据库路径"""
    return os.path.expanduser("~/Library/Messages/chat.db")


def format_date(timestamp: int) -> str:
    """将 iMessage 时间戳转换为可读格式"""
    if not timestamp:
        return "未知时间"
    seconds = timestamp / 1_000_000_000
    message_date = IMESSAGE_EPOCH + timedelta(seconds=seconds)
    return message_date.strftime("%H:%M:%S")


def format_full_date(timestamp: int) -> str:
    """完整日期格式"""
    if not timestamp:
        return "未知时间"
    seconds = timestamp / 1_000_000_000
    message_date = IMESSAGE_EPOCH + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def get_messages_by_email(
    conn: sqlite3.Connection,
    email: str,
    since_timestamp: Optional[int] = None,
    limit: int = 10
) -> List[sqlite3.Row]:
    """
    获取特定邮箱的消息

    Args:
        conn: 数据库连接
        email: 邮箱地址
        since_timestamp: 只获取此时间之后的消息
        limit: 消息数量限制

    Returns:
        消息列表
    """
    cursor = conn.cursor()

    query = """
    SELECT
        m.rowid,
        m.text,
        m.date,
        m.is_from_me,
        m.cache_has_attachments,
        h.id as handle_id,
        c.display_name
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.rowid
    LEFT JOIN chat_message_join cmj ON m.rowid = cmj.message_id
    LEFT JOIN chat c ON cmj.chat_id = c.rowid
    WHERE h.id LIKE ?
    AND m.text IS NOT NULL AND m.text != ''
    AND m.is_from_me = 0
    """

    params = [f"%{email}%"]

    if since_timestamp:
        query += " AND m.date > ?"
        params.append(since_timestamp)

    query += " ORDER BY m.date DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    return cursor.fetchall()


def print_message(msg: sqlite3.Row, email: str):
    """格式化打印消息"""
    text = msg["text"] or "[无内容]"
    date_str = format_full_date(msg["date"])

    print(f"\n  📬 {date_str}")
    print(f"  👤 {email}")
    print(f"  💬 {text}")
    print("  " + "-" * 60)


def check_new_messages(conn: sqlite3.Connection) -> int:
    """
    检查所有监听邮箱的新消息

    Returns:
        新消息数量
    """
    total_new = 0

    for email in MONITOR_EMAILS:
        since_time = last_message_time.get(email, 0)
        messages = get_messages_by_email(conn, email, since_timestamp=since_time)

        if messages:
            # 更新最后时间戳
            latest_time = max(msg["date"] for msg in messages)
            last_message_time[email] = latest_time

            # 显示新消息 (倒序显示，从旧到新)
            for msg in reversed(messages):
                print_message(msg, email)
                total_new += 1

    return total_new


def get_initial_messages(conn: sqlite3.Connection):
    """初始化时获取每个邮箱的最新消息时间戳"""
    for email in MONITOR_EMAILS:
        messages = get_messages_by_email(conn, email, limit=1)
        if messages:
            last_message_time[email] = messages[0]["date"]
        else:
            last_message_time[email] = 0


def print_status(new_count: int, check_num: int):
    """打印状态行"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status = f"✅ {new_count} 条新消息" if new_count > 0 else "✓ 无新消息"
    print(f"[{timestamp}] 检查 #{check_num}: {status}")


def main():
    """主函数"""
    db_path = get_chat_db_path()

    # 检查数据库
    if not os.path.exists(db_path):
        print(f"❌ 错误：找不到 iMessage 数据库\n路径：{db_path}")
        print("\n请确保:")
        print("1. 您在 macOS 系统上运行此脚本")
        print("2. 终端已授予'完全磁盘访问权限'")
        sys.exit(1)

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        print("=" * 70)
        print("📱 iMessage 持续监听")
        print("=" * 70)
        print(f"📧 监听邮箱:")
        for email in MONITOR_EMAILS:
            print(f"   • {email}")
        print(f"⏱️  检查间隔：5 秒")
        print("=" * 70)
        print("\n初始化中...")

        # 初始化：获取当前最新消息的时间戳
        get_initial_messages(conn)
        print("✅ 初始化完成，开始监听...\n")

        check_num = 0

        while True:
            check_num += 1

            try:
                # 检查新消息
                new_count = check_new_messages(conn)

                # 显示简短状态
                print_status(new_count, check_num)

            except sqlite3.Error as e:
                print(f"[错误] 数据库错误：{e}")

            # 等待 5 秒
            time.sleep(5)

    except KeyboardInterrupt:
        print("\n\n👋 监听已停止")
    except Exception as e:
        print(f"\n❌ 发生错误：{e}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
