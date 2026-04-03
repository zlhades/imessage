#!/usr/bin/env python3
"""
iMessage Reply Module

通过 AppleScript 发送 iMessage 回复。
提供简短回复、执行摘要、详细报告、错误通知等功能。
"""

import subprocess
import sys


def send_imessage(contact: str, message: str) -> bool:
    """发送 iMessage"""
    try:
        clean_msg = message.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`').replace('\n', ' ')
        result = subprocess.run([
            'osascript',
            '-e', 'tell application "Messages"',
            '-e', f'send "{clean_msg}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
            '-e', 'end tell'
        ], capture_output=True, text=True, timeout=10)

        if result.returncode == 0:
            return True
        else:
            print(f"❌ 发送失败：{result.stderr}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"❌ 发送异常：{e}", file=sys.stderr)
        return False


def send_quick_reply(contact: str, text: str) -> bool:
    """发送简短回复"""
    return send_imessage(contact, text)


def send_summary(contact: str, original_message: str, execution_result: str, success: bool = True) -> bool:
    """发送执行完成 Summary"""
    status = "✅" if success else "❌"
    summary = f"{status} 执行完成\n\n指令：{original_message[:50]}\n结果：{execution_result[:200]}"
    return send_imessage(contact, summary)


def send_detailed_summary(contact: str, command: str, output: str, error: str = "", duration: float = 0) -> bool:
    """发送详细执行报告"""
    if len(output) > 500:
        output = output[:500] + "... (截断)"
    if len(error) > 200:
        error = error[:200] + "... (截断)"

    report = f"""📊 执行报告

⏱️ 耗时：{duration:.1f}秒
📝 指令：{command}

✅ 输出:
{output if output else '(无输出)'}
"""
    if error:
        report += f"\n❌ 错误:\n{error}"

    return send_imessage(contact, report)


def send_error_notification(contact: str, command: str, error: str) -> bool:
    """发送错误通知"""
    msg = f"❌ 执行失败\n\n指令：{command}\n错误：{error[:200]}"
    return send_imessage(contact, msg)


# ============== 命令行接口 ==============

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法：python3 imessage_reply.py <联系人> <消息内容>")
        sys.exit(1)

    contact = sys.argv[1]
    message = sys.argv[2]

    if send_imessage(contact, message):
        print(f"✅ 已发送 iMessage 到 {contact}")
    else:
        print("❌ 发送失败")
        sys.exit(1)
