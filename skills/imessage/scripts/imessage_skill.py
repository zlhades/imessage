#!/usr/bin/env python3
"""
iMessage MCP Server - Qwen Code Skill
提供读取 iMessage 消息的功能
"""

import sqlite3
import os
import sys
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any


# ============== 配置 ==============
CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")


# ============== 数据库操作 ==============

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
    if not text:
        return "[无内容]"
    if text.strip() == '':
        return "[空白消息]"
    return text


# ============== 核心功能 ==============

def search_contact_messages(
    search_term: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    搜索特定联系人的消息
    
    Args:
        search_term: 联系人姓名、电话或邮箱
        limit: 返回消息数量
    
    Returns:
        消息列表
    """
    conn = get_db_connection()
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
    WHERE h.id LIKE ? OR c.display_name LIKE ?
    ORDER BY m.date DESC
    LIMIT ?
    """
    
    search_pattern = f"%{search_term}%"
    cursor.execute(query, (search_pattern, search_pattern, limit))
    
    results = []
    for row in cursor.fetchall():
        text = row["text"]
        if not text and row["cache_has_attachments"]:
            text = "[附件]"
        
        results.append({
            "id": row["rowid"],
            "text": clean_message_text(text),
            "date": format_timestamp(row["date"]),
            "timestamp": row["date"],
            "is_from_me": bool(row["is_from_me"]),
            "handle": row["handle_id"],
            "display_name": row["display_name"]
        })
    
    conn.close()
    return results


def get_last_message(contact: str) -> Optional[Dict[str, Any]]:
    """
    获取特定联系人的最后一条消息
    
    Args:
        contact: 联系人姓名、电话或邮箱
    
    Returns:
        最后一条消息，未找到返回 None
    """
    messages = search_contact_messages(contact, limit=1)
    return messages[0] if messages else None


def get_all_contacts() -> List[Dict[str, str]]:
    """
    获取所有联系人列表
    
    Returns:
        联系人列表
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
    SELECT DISTINCT h.id, c.display_name
    FROM handle h
    LEFT JOIN chat_handle_join chj ON h.rowid = chj.handle_id
    LEFT JOIN chat c ON chj.chat_id = c.rowid
    WHERE h.id IS NOT NULL
    ORDER BY COALESCE(c.display_name, h.id)
    """
    
    cursor.execute(query)
    
    contacts = []
    for row in cursor.fetchall():
        contacts.append({
            "handle": row["id"],
            "display_name": row["display_name"] or ""
        })
    
    conn.close()
    return contacts


def export_messages(contact: str, output_file: str = "messages.json") -> str:
    """
    导出联系人消息为 JSON
    
    Args:
        contact: 联系人姓名、电话或邮箱
        output_file: 输出文件名
    
    Returns:
        导出文件路径
    """
    messages = search_contact_messages(contact, limit=1000)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            "contact": contact,
            "count": len(messages),
            "messages": messages
        }, f, ensure_ascii=False, indent=2)
    
    return os.path.abspath(output_file)


# ============== MCP Server ==============

def send_result(result: Any):
    """发送结果（用于 MCP 协议）"""
    print(json.dumps(result, ensure_ascii=False, default=str))


def send_error(message: str):
    """发送错误（用于 MCP 协议）"""
    print(json.dumps({"error": message}, ensure_ascii=False))


def main():
    """主函数 - 支持命令行和 MCP 模式"""
    if len(sys.argv) < 2:
        print("用法:")
        print("  imessage.py search <联系人> [数量]")
        print("  imessage.py last <联系人>")
        print("  imessage.py contacts")
        print("  imessage.py export <联系人> [输出文件]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    try:
        if command == "search":
            if len(sys.argv) < 3:
                send_error("请提供联系人姓名/电话")
                sys.exit(1)
            contact = sys.argv[2]
            limit = int(sys.argv[3]) if len(sys.argv) > 3 else 20
            result = search_contact_messages(contact, limit)
            send_result(result)
        
        elif command == "last":
            if len(sys.argv) < 3:
                send_error("请提供联系人姓名/电话")
                sys.exit(1)
            contact = sys.argv[2]
            result = get_last_message(contact)
            if result:
                send_result(result)
            else:
                send_error(f"未找到联系人 {contact} 的消息")
        
        elif command == "contacts":
            result = get_all_contacts()
            send_result(result)
        
        elif command == "export":
            if len(sys.argv) < 3:
                send_error("请提供联系人姓名/电话")
                sys.exit(1)
            contact = sys.argv[2]
            output_file = sys.argv[3] if len(sys.argv) > 3 else "messages.json"
            result = export_messages(contact, output_file)
            send_result({"file": result})
        
        else:
            send_error(f"未知命令：{command}")
            sys.exit(1)
    
    except FileNotFoundError as e:
        send_error(str(e))
        sys.exit(1)
    except PermissionError:
        send_error("权限错误：请授予终端完全磁盘访问权限")
        sys.exit(1)
    except Exception as e:
        send_error(f"发生错误：{e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
