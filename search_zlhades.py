#!/usr/bin/env python3
"""
Search for last message from zlhades @icloud.com
"""

import sqlite3
import os
from datetime import datetime


def get_chat_db_path() -> str:
    return os.path.expanduser("~/Library/Messages/chat.db")


def format_date(timestamp: int) -> str:
    """Convert iMessage timestamp to readable format"""
    if not timestamp:
        return "Unknown time"
    from datetime import timedelta
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    message_date = epoch + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def main():
    db_path = get_chat_db_path()

    if not os.path.exists(db_path):
        print(f"❌ Error: Database not found\nPath: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Search for the email address
    email = "zlhades @icloud.com"

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
    LIMIT 5
    """

    cursor.execute(query, (f"%{email}%", f"%{email}%"))
    rows = cursor.fetchall()

    if rows:
        print("=" * 60)
        print(f"📱 Messages from {email}")
        print("=" * 60)
        
        for i, row in enumerate(rows):
            direction = "Me" if row['is_from_me'] else "Them"
            text = row['text']

            # Handle message content
            if not text:
                if row['cache_has_attachments']:
                    text = "[Attachment: image/video/file]"
                else:
                    text = "[No content]"
            elif text.strip() == '':
                text = "[Blank message]"

            print(f"\n{'📍 LAST MESSAGE (Execute this):' if i == 0 else ''}")
            print(f"📅 Time: {format_date(row['date'])}")
            print(f"👤 Sender: {direction}")
            print(f"📞 Contact: {row['handle_id'] or 'Unknown'}")
            print(f"💬 Message: {text}")
            print("-" * 60)
        
        # Show the last message content for execution
        last_row = rows[0]
        if last_row['text']:
            print("\n\n📋 MESSAGE TO EXECUTE:")
            print("=" * 60)
            print(last_row['text'])
            print("=" * 60)
    else:
        print(f"❌ No messages found for '{email}'")
        
        # Try searching without space in email
        email_no_space = "zlhades@icloud.com"
        cursor.execute(query, (f"%{email_no_space}%", f"%{email_no_space}%"))
        rows = cursor.fetchall()
        
        if rows:
            print(f"\n✅ Found messages with '{email_no_space}' (without space)")
            print("=" * 60)
            
            for i, row in enumerate(rows):
                direction = "Me" if row['is_from_me'] else "Them"
                text = row['text']

                if not text:
                    if row['cache_has_attachments']:
                        text = "[Attachment: image/video/file]"
                    else:
                        text = "[No content]"
                elif text.strip() == '':
                    text = "[Blank message]"

                print(f"\n{'📍 LAST MESSAGE (Execute this):' if i == 0 else ''}")
                print(f"📅 Time: {format_date(row['date'])}")
                print(f"👤 Sender: {direction}")
                print(f"📞 Contact: {row['handle_id'] or 'Unknown'}")
                print(f"💬 Message: {text}")
                print("-" * 60)
            
            # Show the last message content for execution
            last_row = rows[0]
            if last_row['text']:
                print("\n\n📋 MESSAGE TO EXECUTE:")
                print("=" * 60)
                print(last_row['text'])
                print("=" * 60)
        else:
            print(f"❌ No messages found for '{email_no_space}' either")

    conn.close()


if __name__ == "__main__":
    main()
