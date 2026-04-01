#!/usr/bin/env python3
"""
直接读取第一条 iMessage
"""

import sqlite3
import os
from datetime import datetime


def get_chat_db_path() -> str:
    return os.path.expanduser("~/Library/Messages/chat.db")


def format_date(timestamp: int) -> str:
    """将 iMessage 时间戳转换为可读格式"""
    if not timestamp:
        return "未知时间"
    # iMessage 使用 2001-01-01 作为纪元
    from datetime import timedelta
    epoch = datetime(2001, 1, 1)
    seconds = timestamp / 1_000_000_000
    message_date = epoch + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def main():
    db_path = get_chat_db_path()
    
    if not os.path.exists(db_path):
        print(f"❌ 错误：找不到数据库\n路径：{db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 获取特定联系人的最后一条消息
    phone_number = "+18336801616"
    
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
    ORDER BY m.date DESC
    LIMIT 1
    """
    
    cursor.execute(query, (f"%{phone_number}%",))
    row = cursor.fetchone()
    
    if row:
        direction = "我" if row['is_from_me'] else "对方"
        text = row['text']
        
        # 处理消息内容
        if not text:
            if row['cache_has_attachments']:
                text = "[附件：图片/视频/文件]"
            else:
                text = "[无内容]"
        elif text.strip() == '':
            text = "[空白消息]"
        else:
            # 清理可能的乱码，显示原始内容
            try:
                text = text.encode('utf-8', errors='replace').decode('utf-8')
            except:
                text = f"[特殊内容：{repr(text)}]"
        
        print("=" * 60)
        print("📱 第一条 iMessage（最新）")
        print("=" * 60)
        print(f"📅 时间：{format_date(row['date'])}")
        print(f"👤 发送者：{direction}")
        print(f"📞 联系人：{row['handle_id'] or '未知'}")
        print(f"💬 消息：{text}")
        print(f"📝 原始内容：{repr(row['text'])}")
        print("=" * 60)
    else:
        print("❌ 未找到消息")
    
    conn.close()


if __name__ == "__main__":
    main()
