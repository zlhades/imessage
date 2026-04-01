#!/usr/bin/env python3
"""
iMessage MCP Server - 支持读取和执行

工具列表：
- imessage_read: 读取联系人的最后一条消息
- imessage_execute: 读取并执行消息中的指令
- imessage_search: 搜索联系人的消息
"""

import json
import sys
import subprocess
from datetime import datetime, timedelta
import sqlite3
import os

# ============== 数据库操作 ==============

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")


def get_db_connection():
    if not os.path.exists(CHAT_DB_PATH):
        raise FileNotFoundError(f"找不到 iMessage 数据库：{CHAT_DB_PATH}")
    conn = sqlite3.connect(CHAT_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def format_timestamp(timestamp):
    if not timestamp:
        return "未知时间"
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    message_date = epoch + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def extract_text_from_message_row(row):
    text = row['text']
    if text and text.strip():
        return text
    return "[无内容]"


# ============== MCP 工具 ==============

def imessage_read(contact: str):
    """读取联系人的最后一条消息"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
    SELECT m.rowid, m.text, m.date, m.is_from_me, h.id as handle_id
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
        return {"error": "未找到消息"}
    
    return {
        "id": row["rowid"],
        "text": extract_text_from_message_row(row),
        "date": format_timestamp(row["date"]),
        "timestamp": row["date"],
        "is_from_me": bool(row["is_from_me"]),
        "handle": row["handle_id"]
    }


def imessage_execute(contact: str):
    """读取联系人的最后一条消息并返回可执行内容"""
    message = imessage_read(contact)
    
    if "error" in message:
        return message
    
    # 分析消息内容，提取可执行指令
    text = message.get('text', '')
    
    # 返回消息内容和执行建议
    return {
        **message,
        "analysis": analyze_instruction(text),
        "ready_to_execute": True
    }


def analyze_instruction(text: str):
    """分析消息中的指令"""
    analysis = {
        "has_instruction": False,
        "instruction_type": "unknown",
        "summary": "",
        "suggested_action": ""
    }
    
    # 简单关键词匹配
    if any(kw in text.lower() for kw in ["创建", "create", "make", "新建"]):
        analysis["has_instruction"] = True
        analysis["instruction_type"] = "file_creation"
        analysis["suggested_action"] = "创建文件"
    
    if any(kw in text.lower() for kw in ["运行", "run", "执行", "execute"]):
        analysis["has_instruction"] = True
        analysis["instruction_type"] = "command_execution"
        analysis["suggested_action"] = "运行命令"
    
    if any(kw in text.lower() for kw in ["搜索", "search", "查找", "find"]):
        analysis["has_instruction"] = True
        analysis["instruction_type"] = "search"
        analysis["suggested_action"] = "搜索内容"
    
    if not analysis["has_instruction"]:
        analysis["summary"] = "消息包含描述性内容，需要进一步分析"
        analysis["suggested_action"] = "请 Qwen 分析具体需求"
    
    return analysis


def imessage_search(contact: str, limit: int = 10):
    """搜索联系人的消息"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
    SELECT m.rowid, m.text, m.date, m.is_from_me, h.id as handle_id
    FROM message m
    LEFT JOIN handle h ON m.handle_id = h.rowid
    WHERE h.id = ?
    ORDER BY m.date DESC
    LIMIT ?
    """
    
    cursor.execute(query, (contact, limit))
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "id": row["rowid"],
            "text": extract_text_from_message_row(row),
            "date": format_timestamp(row["date"]),
            "timestamp": row["date"],
            "is_from_me": bool(row["is_from_me"]),
            "handle": row["handle_id"]
        })
    
    conn.close()
    return results


# ============== MCP 服务器 ==============

def send_response(result):
    print(json.dumps(result, ensure_ascii=False))


def send_error(message):
    print(json.dumps({"error": message}, ensure_ascii=False))


def main():
    if len(sys.argv) < 2:
        print("用法：python3 imessage-mcp-server.py <command> [args]")
        print("命令：read, execute, search")
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == "read":
            if len(sys.argv) < 3:
                send_error("请提供联系人")
                sys.exit(1)
            contact = sys.argv[2]
            result = imessage_read(contact)
            send_response(result)
        
        elif command == "execute":
            if len(sys.argv) < 3:
                send_error("请提供联系人")
                sys.exit(1)
            contact = sys.argv[2]
            result = imessage_execute(contact)
            send_response(result)
        
        elif command == "search":
            if len(sys.argv) < 3:
                send_error("请提供联系人")
                sys.exit(1)
            contact = sys.argv[2]
            limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            result = imessage_search(contact, limit)
            send_response(result)
        
        else:
            send_error(f"未知命令：{command}")
            sys.exit(1)
    
    except Exception as e:
        send_error(f"发生错误：{e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
