#!/usr/bin/env python3
"""
msg2cli - Database Module

Reads macOS message database, provides message query functions.
Used by MCP Server and watcher.
"""

import sqlite3
import os
import json
import sys
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")


def get_db_connection() -> sqlite3.Connection:
    """Connect to iMessage database."""
    if not os.path.exists(CHAT_DB_PATH):
        raise FileNotFoundError(f"iMessage database not found: {CHAT_DB_PATH}")
    conn = sqlite3.connect(CHAT_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def format_timestamp(timestamp: Optional[int]) -> str:
    """Convert iMessage timestamp to human-readable format."""
    if not timestamp:
        return "unknown"
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    message_date = epoch + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def clean_message_text(text: Optional[str]) -> str:
    """Clean message text."""
    if not text or text.strip() == '':
        return "[no content]"
    return text


def get_last_message(contact: str) -> Optional[Dict[str, Any]]:
    """Get the last message from a contact."""
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
    """Search messages from a contact."""
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
    """Get contact list."""
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
    """Analyze instruction type in message."""
    analysis = {
        "has_instruction": False,
        "instruction_type": "unknown",
        "suggested_action": ""
    }

    text_lower = text.lower()
    if any(kw in text_lower for kw in ["create", "make", "new file"]):
        analysis.update({
            "has_instruction": True,
            "instruction_type": "file_creation",
            "suggested_action": "Create file"
        })
    if any(kw in text_lower for kw in ["run", "execute", "command"]):
        analysis.update({
            "has_instruction": True,
            "instruction_type": "command_execution",
            "suggested_action": "Run command"
        })
    if any(kw in text_lower for kw in ["search", "find", "lookup"]):
        analysis.update({
            "has_instruction": True,
            "instruction_type": "search",
            "suggested_action": "Search content"
        })
    if not analysis["has_instruction"]:
        analysis["suggested_action"] = "Let AI analyze the request"

    return analysis


def main():
    """CLI: python3 imessage_db.py <command> [args]"""
    if len(sys.argv) < 2:
        print("Usage: python3 imessage_db.py <command> [args]")
        print("Commands: last, search, contacts, analyze")
        sys.exit(1)

    command = sys.argv[1]

    try:
        if command == "last":
            contact = sys.argv[2] if len(sys.argv) > 2 else "zlhades@icloud.com"
            result = get_last_message(contact)
            print(json.dumps(result if result else {"error": "No messages found"}, ensure_ascii=False, indent=2))

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
            print(f"Unknown command: {command}")
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
