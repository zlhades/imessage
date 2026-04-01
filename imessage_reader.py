#!/usr/bin/env python3
"""
iMessage 读取工具 - 搜索特定联系人消息

⚠️ 注意：
1. 需要授予终端"完全磁盘访问权限"
2. 仅用于访问您自己的消息数据
3. 数据库路径：~/Library/Messages/chat.db
"""

import sqlite3
import os
from datetime import datetime
from typing import Optional


def get_chat_db_path() -> str:
    """获取 iMessage 数据库路径"""
    return os.path.expanduser("~/Library/Messages/chat.db")


def connect_to_db(db_path: str) -> sqlite3.Connection:
    """连接到数据库"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def search_contact_messages(
    conn: sqlite3.Connection,
    search_term: str,
    limit: int = 50
) -> list:
    """
    搜索特定联系人的消息
    
    Args:
        conn: 数据库连接
        search_term: 搜索词（联系人姓名、电话号码或邮箱）
        limit: 返回消息数量限制
    
    Returns:
        消息列表
    """
    cursor = conn.cursor()
    
    # 查询包含搜索词的对话
    query = """
    SELECT 
        m.rowid,
        m.text,
        m.date,
        m.is_from_me,
        m.service,
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
    
    return cursor.fetchall()


def get_all_contacts(conn: sqlite3.Connection) -> list:
    """获取所有联系人列表"""
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
    return cursor.fetchall()


def format_date(timestamp: int) -> str:
    """将 iMessage 时间戳转换为可读格式"""
    # iMessage 使用 2001-01-01 作为 Unix 纪元
    epoch = datetime(2001, 1, 1)
    message_date = epoch + datetime.fromtimestamp(timestamp / 1_000_000_000)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def main():
    """主函数"""
    db_path = get_chat_db_path()
    
    # 检查数据库是否存在
    if not os.path.exists(db_path):
        print(f"❌ 错误：找不到 iMessage 数据库\n路径：{db_path}")
        print("\n请确保：")
        print("1. 您在 macOS 系统上运行此脚本")
        print("2. 终端已授予'完全磁盘访问权限'")
        return
    
    try:
        conn = connect_to_db(db_path)
        print("✅ 成功连接到 iMessage 数据库\n")
        
        while True:
            print("\n" + "=" * 50)
            print("iMessage 搜索工具")
            print("=" * 50)
            print("1. 搜索联系人消息")
            print("2. 查看所有联系人")
            print("3. 退出")
            
            choice = input("\n请选择操作 (1-3): ").strip()
            
            if choice == "1":
                search_term = input("请输入联系人姓名、电话或邮箱：").strip()
                if not search_term:
                    print("❌ 输入不能为空")
                    continue
                
                try:
                    limit = int(input("返回消息数量限制 (默认 50): ").strip() or "50")
                except ValueError:
                    limit = 50
                
                messages = search_contact_messages(conn, search_term, limit)
                
                if not messages:
                    print(f"\n❌ 未找到与 '{search_term}' 相关的消息")
                else:
                    print(f"\n✅ 找到 {len(messages)} 条消息:\n")
                    print("-" * 50)
                    
                    for msg in messages:
                        direction = "我" if msg["is_from_me"] else "对方"
                        text = msg["text"] or "[无内容]"
                        date = format_date(msg["date"]) if msg["date"] else "未知时间"
                        handle = msg["handle_id"] or "未知"
                        
                        print(f"📅 {date}")
                        print(f"👤 {direction} | 联系人：{handle}")
                        print(f"💬 {text}")
                        print("-" * 50)
            
            elif choice == "2":
                contacts = get_all_contacts(conn)
                print(f"\n✅ 共找到 {len(contacts)} 个联系人:\n")
                
                for contact in contacts:
                    display_name = contact["display_name"] or "无昵称"
                    handle_id = contact["id"] or "未知"
                    print(f"  • {display_name} ({handle_id})")
            
            elif choice == "3":
                print("\n👋 再见!")
                break
            
            else:
                print("❌ 无效选择，请重试")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ 数据库错误：{e}")
    except PermissionError:
        print(f"❌ 权限错误：无法访问 {db_path}")
        print("\n解决方法：")
        print("1. 打开 系统设置 > 隐私与安全性 > 完全磁盘访问权限")
        print("2. 添加您的终端应用")
        print("3. 重启终端后重试")
    except Exception as e:
        print(f"❌ 发生错误：{e}")


if __name__ == "__main__":
    main()
