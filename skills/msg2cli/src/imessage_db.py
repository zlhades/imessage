#!/usr/bin/env python3
"""
msg2cli - Database Module

读取 macOS 消息数据库（iMessage/Slack 等），提供消息查询功能。
支持 MCP Server 和自动监听器调用。
"""

import sqlite3
import os
import json
import sys
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")


def get_db_connection() -> sqlite3.Connection:
    """连接到 iMessage 数据库"""
    if not os.path.exists(CHAT_DB_PATH):
        raise FileNotFoundError(f"找不到 iMessage 数据库：{CHAT_DB_PATH}")
    conn = sqlite3.connect(CHAT_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def format_timestamp(timestamp: Optional[int]) -> str:
    """将 iMessage 时间戳转换为可读格式"""
    if not timestamp:
        return "未知时间"
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    message_date = epoch + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def clean_message_text(text: Optional[str]) -> str:
    """清理消息文本"""
    if not text or text.strip() == '':
        return "[无内容]"
    return text


def get_last_message(contact: str) -> Optional[Dict[str, Any]]:
    """获取特定联系人的最后一条消息"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT m.rowid, m.text, m.date, m.is_from_me, h.id as handle_id
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.rowid
        WHERE h.id = ?
        ORDER BY m.date DESC
        LIMIT 1
    """, (contact,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["rowid"],
        "text": clean_message_text(row["text"]),
        "date": format_timestamp(row["date"]),
        "timestamp": row["date"],
        "is_from_me": bool(row["is_from_me"]),
        "handle": row["handle_id"]
    }


def search_messages(contact: str, limit: int = 10) -> List[Dict[str, Any]]:
    """搜索联系人的消息"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT m.rowid, m.text, m.date, m.is_from_me, h.id as handle_id
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.rowid
        WHERE h.id = ?
        ORDER BY m.date DESC
        LIMIT ?
    """, (contact, limit))

    results = []
    for row in cursor.fetchall():
        results.append({
            "id": row["rowid"],
            "text": clean_message_text(row["text"]),
            "date": format_timestamp(row["date"]),
            "timestamp": row["date"],
            "is_from_me": bool(row["is_from_me"]),
            "handle": row["handle_id"]
        })
    conn.close()
    return results


def get_all_contacts() -> List[Dict[str, str]]:
    """获取所有联系人列表"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT h.id, c.display_name
        FROM handle h
        LEFT JOIN chat_handle_join chj ON h.rowid = chj.handle_id
        LEFT JOIN chat c ON chj.chat_id = c.rowid
        WHERE h.id IS NOT NULL
        ORDER BY COALESCE(c.display_name, h.id)
    """)

    contacts = []
    for row in cursor.fetchall():
        contacts.append({
            "handle": row["id"],
            "display_name": row["display_name"] or ""
        })
    conn.close()
    return contacts


def analyze_instruction(text: str) -> Dict[str, Any]:
    """分析消息中的指令类型"""
    analysis = {
        "has_instruction": False,
        "instruction_type": "unknown",
        "suggested_action": ""
    }

    text_lower = text.lower()
    if any(kw in text_lower for kw in ["创建", "create", "make", "新建"]):
        analysis.update({"has_instruction": True, "instruction_type": "file_creation", "suggested_action": "创建文件"})
    if any(kw in text_lower for kw in ["运行", "run", "执行", "execute"]):
        analysis.update({"has_instruction": True, "instruction_type": "command_execution", "suggested_action": "运行命令"})
    if any(kw in text_lower for kw in ["搜索", "search", "查找", "find"]):
        analysis.update({"has_instruction": True, "instruction_type": "search", "suggested_action": "搜索内容"})
    if not analysis["has_instruction"]:
        analysis["suggested_action"] = "请 AI 分析具体需求"

    return analysis


# ============== 命令行接口 ==============

def main():
    """命令行：python3 imessage_db.py <command> [args]"""
    if len(sys.argv) < 2:
        print("用法: python3 imessage_db.py <command> [args]")
        print("命令: last, search, contacts, analyze")
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "last":
            contact = sys.argv[2] if len(sys.argv) > 2 else "zlhades@icloud.com"
            result = get_last_message(contact)
            print(json.dumps(result if result else {"error": "未找到消息"}, ensure_ascii=False, indent=2))

        elif command == "search":
            contact = sys.argv[2] if len(sys.argv) > 2 else "zlhades@icloud.com"
            limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            result = search_messages(contact, limit)
            print(json.dumps(result, ensure_ascii=False, indent=2))

        elif command == "contacts":
            result = get_all_contacts()
            print(json.dumps(result, ensure_ascii=False, indent=2))

        elif command == "analyze":
            text = sys.argv[2] if len(sys.argv) > 2 else ""
            result = analyze_instruction(text)
            print(json.dumps(result, ensure_ascii=False, indent=2))

        else:
            print(f"未知命令：{command}")
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
