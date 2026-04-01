#!/usr/bin/env python3
"""
iMessage 命令执行引擎 - 带自动回复
读取 iMessage → 分析指令 → 自动执行 → 发送 Summary
"""

import json
import subprocess
import sys
import os
import time
from datetime import datetime

# 导入自动回复模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imessage-reply import send_summary, send_detailed_summary, send_quick_reply, send_error_notification


def get_last_message(contact):
    """获取最后一条消息"""
    result = subprocess.run(
        ["python3", "/Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py", "execute", contact],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)


def analyze_and_execute(message, contact):
    """分析消息并执行，返回结果"""
    text = message.get('text', '')
    start_time = time.time()

    print(f"\n📱 消息内容：{text}")
    print("\n🔍 分析中...")

    # 先发送一个"收到"的快速回复
    send_quick_reply(contact, "📥 收到指令，正在处理...")

    # 调用 Qwen 分析并执行
    prompt = f"""请分析这条 iMessage 消息并执行其中的指令：

【消息】
{text}

【任务】
1. 识别消息中的可执行指令
2. 如果有明确指令，请直接执行（创建文件、运行命令等）
3. 如果是问题，请回答
4. 返回执行结果

请开始执行："""

    print("\n🤖 执行中...\n")

    try:
        result = subprocess.run(
            ["qwen", "-p", prompt, "-y"],
            capture_output=True,
            text=True,
            timeout=120
        )

        duration = time.time() - start_time
        output = result.stdout

        print(output)

        # 分析结果类型
        analysis = {
            "type": "command_execution",
            "status": "成功" if result.returncode == 0 else "失败"
        }

        # 发送详细摘要
        send_detailed_summary(
            contact=contact,
            original_message=text,
            analysis=analysis,
            execution_result=output,
            duration=duration
        )

        return output

    except subprocess.TimeoutExpired:
        duration = time.time() - start_time
        print("⏰ 执行超时")
        send_error_notification(contact, "命令执行超时（超过 120 秒）", text)
        return "执行超时"
    except Exception as e:
        duration = time.time() - start_time
        print(f"❌ 执行失败：{e}")
        send_error_notification(contact, str(e), text)
        return f"执行失败：{e}"


def main():
    if len(sys.argv) < 2:
        print("用法：python3 imessage-run.py <联系人>")
        print("示例：python3 imessage-run.py zlhades@icloud.com")
        print()
        print("功能：读取 iMessage → 自动执行 → 发送 Summary 回复")
        sys.exit(1)

    contact = sys.argv[1]

    print("╔═══════════════════════════════════════════════════════════╗")
    print("║     iMessage 命令执行引擎 - 带自动回复                     ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print()

    # 步骤 1: 读取消息
    print(f"📱 正在读取 {contact} 的最后一条消息...")
    message = get_last_message(contact)

    if "error" in message:
        print(f"❌ 错误：{message['error']}")
        sys.exit(1)

    print(f"📅 时间：{message['date']}")
    print(f"👤 发送者：{'我' if message.get('is_from_me') else '对方'}")
    print(f"💬 内容：{message['text']}")
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # 步骤 2: 分析并执行（自动发送 Summary）
    result = analyze_and_execute(message, contact)

    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("✅ 执行完成，Summary 已发送到 iMessage")


if __name__ == "__main__":
    main()
