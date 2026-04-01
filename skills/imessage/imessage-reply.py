#!/usr/bin/env python3
"""
imessage-reply.py - iMessage 自动回复模块

功能：
1. 发送执行完成 Summary
2. 发送详细执行报告
3. 发送错误通知
"""

import subprocess
import os

def send_imessage(contact, message):
    """发送 iMessage"""
    try:
        # 清理消息中的特殊字符
        clean_msg = message.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
        
        result = subprocess.run([
            'osascript',
            '-e', 'tell application "Messages"',
            '-e', f'send "{clean_msg}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
            '-e', 'end tell'
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print(f"✅ 已发送 iMessage 到 {contact}")
            return True
        else:
            print(f"❌ 发送失败：{result.stderr}")
            return False
    except Exception as e:
        print(f"❌ 异常：{e}")
        return False


def send_quick_reply(contact, text):
    """发送简短回复"""
    return send_imessage(contact, text)


def send_summary(contact, command, result, status="✅"):
    """
    发送执行完成 Summary
    
    Args:
        contact: 联系人
        command: 执行的命令
        result: 执行结果
        status: 状态图标
    """
    summary = f"{status} 执行完成\n\n命令：{command}\n结果：{result[:100]}"
    return send_imessage(contact, summary)


def send_detailed_summary(contact, command, output, error="", duration=0):
    """
    发送详细执行报告
    
    Args:
        contact: 联系人
        command: 执行的命令
        output: 标准输出
        error: 错误输出
        duration: 执行时长（秒）
    """
    # 截断长输出
    if len(output) > 500:
        output = output[:500] + "... (截断)"
    if len(error) > 200:
        error = error[:200] + "... (截断)"
    
    report = f"""📊 执行报告

⏱️ 耗时：{duration:.1f}秒
📝 命令：{command}

✅ 输出:
{output if output else '(无输出)'}
"""
    if error:
        report += f"\n❌ 错误:\n{error}"
    
    return send_imessage(contact, report)


def send_error_notification(contact, command, error):
    """
    发送错误通知
    
    Args:
        contact: 联系人
        command: 执行的命令
        error: 错误信息
    """
    msg = f"❌ 执行失败\n\n命令：{command}\n错误：{error[:200]}"
    return send_imessage(contact, msg)


# 测试
if __name__ == "__main__":
    print("测试 iMessage 自动回复模块...")
    
    # 测试发送
    test_contact = "zlhades@icloud.com"
    
    print("\n1. 测试简短回复...")
    send_quick_reply(test_contact, "✅ 自动回复模块测试成功！")
    
    print("\n2. 测试 Summary...")
    send_summary(test_contact, "ls -la", "total 100\ndrwxr-xr-x  5 user  staff  160 Jan 1 12:00 .")
    
    print("\n3. 测试详细报告...")
    send_detailed_summary(test_contact, "python3 test.py", "Test passed!\nAll 10 tests completed.", "", 2.5)
    
    print("\n✅ 测试完成！")
