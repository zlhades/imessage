#!/usr/bin/env python3
"""
iMessage Command Reader - 读取最新 iMessage 并提取可执行命令

用法:
    python3 imessage_command.py [--contact CONTACT] [--limit N]

功能:
    1. 读取最新的 iMessage
    2. 显示消息内容
    3. 提取可执行的命令/指令
"""

import sqlite3
import os
import sys
import argparse
from datetime import datetime, timedelta
from typing import Optional, List


# iMessage 时间戳纪元
IMESSAGE_EPOCH = datetime(2001, 1, 1)


def get_chat_db_path() -> str:
    """获取 iMessage 数据库路径"""
    return os.path.expanduser("~/Library/Messages/chat.db")


def format_date(timestamp: int) -> str:
    """将 iMessage 时间戳转换为可读格式"""
    if not timestamp:
        return "未知时间"
    seconds = timestamp / 1_000_000_000
    message_date = IMESSAGE_EPOCH + timedelta(seconds=seconds)
    return message_date.strftime("%Y-%m-%d %H:%M:%S")


def get_latest_message(
    conn: sqlite3.Connection,
    contact: Optional[str] = None,
    exclude_sent_by_me: bool = True
) -> Optional[sqlite3.Row]:
    """
    获取最新的 iMessage

    Args:
        conn: 数据库连接
        contact: 可选的联系人过滤 (邮箱/电话/昵称)
        exclude_sent_by_me: 是否排除自己发送的消息

    Returns:
        最新消息记录或 None
    """
    cursor = conn.cursor()

    if contact:
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
        WHERE (h.id LIKE ? OR c.display_name LIKE ?)
        AND m.text IS NOT NULL AND m.text != ''
        """
        if exclude_sent_by_me:
            query += " AND m.is_from_me = 0"
        query += " ORDER BY m.date DESC LIMIT 1"

        search_pattern = f"%{contact}%"
        cursor.execute(query, (search_pattern, search_pattern))
    else:
        # 获取所有联系人的最新消息
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
        WHERE m.text IS NOT NULL AND m.text != ''
        """
        if exclude_sent_by_me:
            query += " AND m.is_from_me = 0"
        query += " ORDER BY m.date DESC LIMIT 1"

        cursor.execute(query)

    return cursor.fetchone()


def get_recent_messages(
    conn: sqlite3.Connection,
    limit: int = 5,
    exclude_sent_by_me: bool = True
) -> List[sqlite3.Row]:
    """获取最近的多条消息"""
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
    WHERE m.text IS NOT NULL AND m.text != ''
    """
    if exclude_sent_by_me:
        query += " AND m.is_from_me = 0"
    query += " ORDER BY m.date DESC LIMIT ?"

    cursor.execute(query, (limit,))
    return cursor.fetchall()


def extract_command(text: str) -> Optional[str]:
    """
    从消息文本中提取可执行的命令/指令

    识别模式:
    - 数字列表 (1. xxx, 2. xxx)
    - 命令关键词 (执行，运行，创建，等)
    """
    if not text:
        return None

    # 清理文本
    text = text.strip()

    # 检查是否包含命令特征
    command_keywords = ['执行', '运行', '创建', '删除', '修改', '读取', '发送', '调用']
    has_command = any(kw in text for kw in command_keywords)

    # 检查是否有数字列表
    has_numbered_list = any(f"{i}." in text or f"{i}、" in text for i in range(1, 10))

    if has_command or has_numbered_list:
        return text

    return None


def print_message(msg: sqlite3.Row, show_raw: bool = False):
    """格式化打印消息"""
    direction = "我" if msg["is_from_me"] else "对方"

    print("=" * 70)
    print("📱 iMessage Command")
    print("=" * 70)
    print(f"📅 时间：{format_date(msg['date'])}")
    print(f"👤 发送者：{direction}")
    print(f"📞 联系人：{msg['handle_id'] or '未知'}")

    text = msg["text"] or "[无内容]"
    if msg["cache_has_attachments"] and not text.strip():
        text = "[附件：图片/视频/文件]"

    print(f"💬 消息内容:")
    print(f"   {text}")

    if show_raw:
        print(f"\n📝 原始内容: {repr(msg['text'])}")

    # 提取命令
    command = extract_command(text)
    if command:
        print(f"\n🎯 提取的命令/指令:")
        print(f"   {command}")
    else:
        print(f"\n⚠️  未检测到明确的命令/指令")

    print("=" * 70)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="读取 iMessage 中的命令",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 imessage_command.py                    # 读取最新消息
  python3 imessage_command.py --contact hotmail  # 读取特定联系人消息
  python3 imessage_command.py --limit 5          # 读取最近 5 条消息
  python3 imessage_command.py --raw              # 显示原始内容
        """
    )

    parser.add_argument(
        "--contact", "-c",
        help="联系人 (邮箱/电话/昵称 的部分匹配)"
    )
    parser.add_argument(
        "--limit", "-l",
        type=int,
        default=1,
        help="返回消息数量 (默认 1)"
    )
    parser.add_argument(
        "--raw", "-r",
        action="store_true",
        help="显示原始内容"
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="包含自己发送的消息"
    )

    args = parser.parse_args()

    db_path = get_chat_db_path()

    # 检查数据库
    if not os.path.exists(db_path):
        print(f"❌ 错误：找不到 iMessage 数据库\n路径：{db_path}")
        print("\n请确保:")
        print("1. 您在 macOS 系统上运行此脚本")
        print("2. 终端已授予'完全磁盘访问权限'")
        sys.exit(1)

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        if args.limit > 1 or args.contact is None:
            # 显示多条消息
            messages = get_recent_messages(
                conn,
                limit=args.limit,
                exclude_sent_by_me=not args.all
            )

            if not messages:
                print("❌ 未找到消息")
                sys.exit(0)

            print(f"\n📬 最近 {len(messages)} 条 iMessage:\n")
            for i, msg in enumerate(messages, 1):
                print(f"\n[消息 {i}]")
                print_message(msg, show_raw=args.raw)

        else:
            # 显示单条最新消息
            msg = get_latest_message(
                conn,
                contact=args.contact,
                exclude_sent_by_me=not args.all
            )

            if not msg:
                print(f"❌ 未找到消息")
                if args.contact:
                    print(f"联系人：{args.contact}")
                sys.exit(0)

            print_message(msg, show_raw=args.raw)

        conn.close()

    except PermissionError:
        print(f"❌ 权限错误：无法访问 {db_path}")
        print("\n解决方法:")
        print("1. 打开 系统设置 > 隐私与安全性 > 完全磁盘访问权限")
        print("2. 添加您的终端应用")
        print("3. 重启终端后重试")
        sys.exit(1)
    except sqlite3.Error as e:
        print(f"❌ 数据库错误：{e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 发生错误：{e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
