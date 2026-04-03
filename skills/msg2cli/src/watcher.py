#!/usr/bin/env python3
"""
msg2cli - Watcher

监听输入源的新消息，注入到 AI CLI 执行，并发送回复。
"""

import os
import sys
import time
import yaml
from datetime import datetime
from typing import Dict, Any, Optional

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from input.base import BaseInput, Message
from output.base import BaseOutput
from reply.base import BaseReply


def load_config(config_path: str) -> Dict[str, Any]:
    """加载 YAML 配置"""
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def create_input(config: Dict[str, Any]) -> BaseInput:
    """根据配置创建输入源"""
    from input.imessage import IMessageInput
    # 未来支持更多输入源
    return IMessageInput(config)


def create_output(config: Dict[str, Any]) -> BaseOutput:
    """根据配置创建输出目标"""
    from output.qwen import QwenOutput
    # 未来支持更多输出
    return QwenOutput(config)


def create_reply(config: Dict[str, Any]) -> BaseReply:
    """根据配置创建回复模块"""
    from reply.imessage import IMessageReply
    return IMessageReply(config)


class Watcher:
    """消息监听器"""

    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config", "config.yaml")

        self.config = load_config(config_path)
        self.settings = self.config.get("settings", {})
        self.log_file = self.settings.get("log_file", "/tmp/msg2cli.log")
        self.done_file = self.settings.get("done_file", "/tmp/msg2cli_done.txt")
        self.auto_markers = self.settings.get("auto_markers", [])

        # 创建输入/输出/回复实例
        imessage_config = self.config["inputs"]["imessage"]
        output_name = self.config["routing"].get("default_output", "qwen")
        output_config = self.config["outputs"].get(output_name, {})
        reply_config = self.config.get("reply", {}).get("imessage", {})

        self.input: BaseInput = create_input(imessage_config)
        self.output: BaseOutput = create_output(output_config)
        self.reply: BaseReply = create_reply(reply_config)
        self.reply_to = reply_config.get("reply_to", "")
        self.check_interval = imessage_config.get("check_interval", 3)

        # 加载已处理消息
        self.done = set()
        if os.path.exists(self.done_file):
            self.done = set(open(self.done_file).read().strip().split('\n'))

        self.last_msg: Optional[str] = None

    def log(self, msg: str):
        t = datetime.now().strftime('%H:%M:%S')
        line = f"[{t}] {msg}"
        print(line)
        with open(self.log_file, 'a') as f:
            f.write(line + "\n")

    def run(self):
        """启动监听"""
        self.log("╔═══════════════════════════════════╗")
        self.log("║  msg2cli Watcher                   ║")
        self.log("╚═══════════════════════════════════╝")
        self.log(f"📱 输入：iMessage ({', '.join(self.input.contacts)})")
        self.log(f"🤖 输出：{self.output.__class__.__name__}")
        self.log(f"📤 回复：{self.reply_to}")

        # 获取初始消息
        last = self.input.get_last_message()
        if last:
            self.last_msg = last.text
            self.log(f"✅ 初始消息 ID: {last.id}")

        self.log("🕐 开始监听...")
        n = 0
        pending = None
        pending_contact = None
        start_time = None

        try:
            while True:
                # 1. 检查新消息
                msg = self.input.get_last_message()
                if msg and msg.text != self.last_msg and not msg.is_from_me:
                    self.log(f"\n🔔 新消息 from {msg.sender}: {msg.text[:40]}...")

                    if msg.text not in self.done and not self.input.is_auto_message(msg.text, self.auto_markers):
                        if self.output.inject(msg.text):
                            n += 1
                            self.reply.send(msg.sender, f"✅ 收到：{msg.text[:30]}...")
                            pending = msg.text
                            pending_contact = msg.sender
                            start_time = time.time()
                            self.done.add(msg.text)
                            open(self.done_file, 'w').write('\n'.join(self.done))
                    self.last_msg = msg.text

                # 2. 检查 AI 是否完成
                if pending and start_time:
                    elapsed = time.time() - start_time
                    if elapsed > 10:
                        finished, output = self.output.is_finished()
                        if finished:
                            self.log("✅ AI 完成，发送结果...")
                            lines = output.split('\n')
                            result = '\n'.join(lines[-30:])
                            if len(result) > 300:
                                result = result[:300] + "..."
                            self.reply.send_summary(pending_contact, pending, result)
                            pending = None
                            start_time = None
                        elif elapsed > 60:
                            self.log("⏱️ 超时，补发通知")
                            self.reply.send(pending_contact, "⏱️ 执行中...")
                            pending = None
                            start_time = None

                time.sleep(self.check_interval)

        except KeyboardInterrupt:
            self.log(f"\n👋 已停止 (共 {n} 条)")


if __name__ == "__main__":
    watcher = Watcher()
    watcher.run()
