#!/usr/bin/env python3
"""
改进的 iMessage 读取工具 - 支持中文消息
"""

import sqlite3
import os
import plistlib
import re
from datetime import datetime, timedelta


def get_db_path():
    return os.path.expanduser("~/Library/Messages/chat.db")


def format_timestamp(timestamp):
    """将 iMessage 时间戳转换为可读格式"""
    if not timestamp:
        return "未知时间"
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    message_date = epoch + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def extract_text_from_attributed_body(blob):
    """从 attributedBody BLOB 中提取文本"""
    if not blob:
        return None
    
    try:
        # 尝试解析为 plist
        plist_data = plistlib.loads(blob)
        
        # 提取文本内容
        if isinstance(plist_data, dict):
            # 查找 NSString 内容
            if 'NS.string' in str(plist_data):
                # 尝试提取文本
                text = str(plist_data)
                # 清理 plist 格式
                text = re.sub(r'<[^>]+>', '', text)
                text = re.sub(r'\{[^}]+\}', '', text)
                return text.strip() if text.strip() else None
        
        return None
    except:
        return None


def extract_text_from_message_row(row):
    """从消息行中提取文本"""
    # 首先尝试 text 字段
    text = row['text']
    if text and text.strip():
        return text
    
    # 尝试 attributedBody
    attributed_body = row['attributedBody']
    if attributed_body:
        text = extract_text_from_attributed_body(attributed_body)
        if text:
            return text
    
    return None


def get_last_message(contact):
    """获取联系人的最后一条消息"""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = """
    SELECT 
        m.rowid,
        m.text,
        m.attributedBody,
        m.date,
        m.is_from_me,
        h.id as handle_id
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.rowid
    WHERE h.id = ?
    ORDER BY m.date DESC
    LIMIT 1
    """
    
    cursor.execute(query, (contact,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    text = extract_text_from_message_row(dict(row))
    
    return {
        "id": row["rowid"],
        "text": text if text else "[无内容]",
        "date": format_timestamp(row["date"]),
        "timestamp": row["date"],
        "is_from_me": bool(row["is_from_me"]),
        "handle": row["handle_id"]
    }


def search_messages(contact, limit=10):
    """搜索联系人的消息"""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = """
    SELECT 
        m.rowid,
        m.text,
        m.attributedBody,
        m.date,
        m.is_from_me,
        h.id as handle_id
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.rowid
    WHERE h.id = ?
    ORDER BY m.date DESC
    LIMIT ?
    """
    
    cursor.execute(query, (contact, limit))
    
    results = []
    for row in cursor.fetchall():
        text = extract_text_from_message_row(dict(row))
        results.append({
            "id": row["rowid"],
            "text": text if text else "[无内容]",
            "date": format_timestamp(row["date"]),
            "timestamp": row["date"],
            "is_from_me": bool(row["is_from_me"]),
            "handle": row["handle_id"]
        })
    
    conn.close()
    return results


if __name__ == "__main__":
    import sys
    import json
    
    if len(sys.argv) < 3:
        print("用法：python3 imessage_skill_v2.py <last|search> <contact> [limit]")
        sys.exit(1)
    
    command = sys.argv[1]
    contact = sys.argv[2]
    
    if command == "last":
        result = get_last_message(contact)
        print(json.dumps(result, ensure_ascii=False))
    elif command == "search":
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        results = search_messages(contact, limit)
        print(json.dumps(results, ensure_ascii=False))
    else:
        print(f"未知命令：{command}")
        sys.exit(1)
