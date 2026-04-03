#!/usr/bin/env python3
"""
msg2cli - iMessage Input

Reads messages from macOS iMessage SQLite database.
"""

import sqlite3
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from .base import BaseInput, Message


class IMessageInput(BaseInput):
    """iMessage input source."""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.db_path = os.path.expanduser(config.get("db_path", "~/Library/Messages/chat.db"))

    def _get_connection(self) -> sqlite3.Connection:
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"iMessage database not found: {self.db_path}")
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _format_timestamp(timestamp: Optional[int]) -> str:
        if not timestamp:
            return "unknown"
        epoch = datetime(2001, 1, 1)
        seconds = timestamp / 1_000_000_000
        message_date = epoch + timedelta(seconds=seconds)
        return message_date.strftime("%Y-%m-%d %H:%M:%S")

    def get_last_message(self) -> Optional[Message]:
        """Get the last message from all monitored contacts."""
        if not os.path.exists(self.db_path):
            return None

        conn = self._get_connection()
        cursor = conn.cursor()
        placeholders = ','.join('?' * len(self.contacts))
        cursor.execute(f"""
            SELECT m.rowid, m.text, m.date, m.is_from_me, h.id as handle_id
            FROM message m
            LEFT JOIN handle h ON m.handle_id = h.rowid
            WHERE h.id IN ({placeholders})
            ORDER BY m.date DESC
            LIMIT 1
        """, self.contacts)
        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        return Message(
            id=row["rowid"],
            text=row["text"] if row["text"] else "[no content]",
            sender=row["handle_id"],
            timestamp=row["date"],
            is_from_me=bool(row["is_from_me"])
        )

    def search_messages(self, contact: str, limit: int = 10) -> List[Message]:
        """Search messages from a specific contact."""
        conn = self._get_connection()
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
            results.append(Message(
                id=row["rowid"],
                text=row["text"] if row["text"] else "[no content]",
                sender=row["handle_id"],
                timestamp=row["date"],
                is_from_me=bool(row["is_from_me"])
            ))
        conn.close()
        return results

    def get_contacts(self) -> List[Dict[str, str]]:
        """Get contact list."""
        conn = self._get_connection()
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
