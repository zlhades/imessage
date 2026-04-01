#!/usr/bin/env python3
"""
读取所有联系人的最新 iMessage 消息
"""

import sqlite3
import os
from datetime import datetime, timedelta

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")


def format_timestamp(timestamp):
    """将 iMessage 时间戳转换为可读格式"""
    if not timestamp:
        return "未知时间"
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    message_date = epoch + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def get_all_contacts_latest_messages():
    """获取所有联系人的最新一条消息"""
    if not os.path.exists(CHAT_DB_PATH):
        print(f"❌ 错误：找不到 iMessage 数据库\n路径：{CHAT_DB_PATH}")
        return []

    conn = sqlite3.connect(CHAT_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 获取每个联系人的最新一条消息
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
    WHERE h.id IS NOT NULL
    AND m.rowid IN (
        SELECT MAX(m2.rowid)
        FROM message m2
        LEFT JOIN handle h2 ON m2.handle_id = h2.rowid
        LEFT JOIN chat_message_join cmj2 ON m2.rowid = cmj2.message_id
        WHERE h2.id IS NOT NULL
        GROUP BY h2.id
    )
    ORDER BY m.date DESC
    """

    cursor.execute(query)
    results = []
    for row in cursor.fetchall():
        text = row["text"]
        if not text and row["cache_has_attachments"]:
            text = "[图片/附件]"
        elif not text:
            text = "[无内容]"

        results.append({
            "handle": row["handle_id"],
            "display_name": row["display_name"] or "",
            "text": text,
            "date": format_timestamp(row["date"]),
            "is_from_me": bool(row["is_from_me"])
        })

    conn.close()
    return results


def main():
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║     iMessage - 所有联系人最新消息                         ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print("")

    messages = get_all_contacts_latest_messages()

    if not messages:
        print("⚠️  未找到任何消息")
        return

    print(f"✅ 共找到 {len(messages)} 个联系人\n")
    print("=" * 70)

    for i, msg in enumerate(messages, 1):
        name = msg["display_name"] if msg["display_name"] else msg["handle"]
        direction = "📤 我" if msg["is_from_me"] else "📥 对方"
        
        print(f"\n{i}. {name}")
        print(f"   {direction} | {msg['date']}")
        print(f"   💬 {msg['text'][:100]}{'...' if len(msg['text']) > 100 else ''}")
        print("-" * 70)


if __name__ == "__main__":
    main()
