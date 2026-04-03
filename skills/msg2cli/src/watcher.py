#!/usr/bin/env python3
"""
msg2cli - Watcher

监听输入源的新消息，注入到 AI CLI 执行，并发送回复。

工作流程：
1. 轮询检测新消息
2. 匹配自动回复模式（如果命中，直接回复）
3. 否则注入到 AI CLI
4. 等待执行完成，发送结果回复
"""

import os
import sys
import time
import re
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from input.base import BaseInput, Message
from output.base import BaseOutput
from reply.base import BaseReply


def load_config(config_path: str) -> Dict[str, Any]:
    """加载 YAML 配置"""
    import yaml
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def create_input(config: Dict[str, Any]) -> BaseInput:
    """根据配置创建输入源"""
    from input.imessage import IMessageInput
    return IMessageInput(config)


def create_output(config: Dict[str, Any]) -> BaseOutput:
    """根据配置创建输出目标"""
    from output.qwen import QwenOutput
    return QwenOutput(config)


def create_reply(config: Dict[str, Any]) -> BaseReply:
    """根据配置创建回复模块"""
    from reply.imessage import IMessageReply
    return IMessageReply(config)


class Watcher:
    """消息监听器"""

    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "config", "config.yaml"
            )

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
        self.check_interval = imessage_config.get("check_interval", 3)

        # 自动回复模式（从 config 加载）
        self.auto_patterns: List[Tuple[str, str]] = []
        reply_config_obj = self.config.get("reply", {}).get("imessage", {})
        for rule in reply_config_obj.get("auto_reply_patterns", []):
            pattern = rule.get("pattern", "")
            response = rule.get("response", "")
            if pattern and response:
                self.auto_patterns.append((pattern, response))

        # 加载已处理消息
        self.done = set()
        if os.path.exists(self.done_file):
            self.done = set(open(self.done_file).read().strip().split('\n'))

        self.last_msg_text: Optional[str] = None
        self.stats = {"total": 0, "auto_reply": 0, "ai_inject": 0, "skipped": 0}

    def log(self, msg: str):
        t = datetime.now().strftime('%H:%M:%S')
        line = f"[{t}] {msg}"
        print(line)
        with open(self.log_file, 'a') as f:
            f.write(line + "\n")

    def match_auto_reply(self, text: str) -> Optional[str]:
        """匹配自动回复模式"""
        for pattern, response in self.auto_patterns:
            if pattern in text:
                return response
        return None

    def is_new_message(self, msg: Message) -> bool:
        """判断是否是新消息"""
        if not msg or msg.is_from_me:
            return False
        if msg.text == self.last_msg_text:
            return False
        if msg.text in self.done:
            return False
        if self.input.is_auto_message(msg.text, self.auto_markers):
            return False
        return True

    def mark_done(self, text: str):
        """标记消息为已处理"""
        self.done.add(text)
        # 限制 done 文件大小
        if len(self.done) > 1000:
            self.done = set(list(self.done)[-500:])
        try:
            with open(self.done_file, 'w') as f:
                f.write('\n'.join(self.done))
        except OSError:
            pass

    def run(self):
        """启动监听"""
        self.log("=" * 35)
        self.log("  msg2cli Watcher")
        self.log("=" * 35)
        self.log(f"📱 输入：iMessage ({', '.join(self.input.contacts)})")
        self.log(f"🤖 输出：{self.output.__class__.__name__}")
        self.log(f"📤 回复：{self.reply.reply_to if self.reply else 'N/A'}")
        self.log(f"🔄 自动回复规则：{len(self.auto_patterns)} 条")
        self.log(f"🕐 轮询间隔：{self.check_interval}s")

        # 获取初始消息
        last = self.input.get_last_message()
        if last:
            self.last_msg_text = last.text
            self.log(f"✅ 初始消息：{last.text[:50]}...")

        self.log("🚀 开始监听...")
        pending_text = None
        pending_contact = None
        pending_start = None
        check_count = 0

        try:
            while True:
                check_count += 1

                # 1. 检查新消息
                msg = self.input.get_last_message()
                if msg and self.is_new_message(msg):
                    self.log(f"\n🔔 新消息 from {msg.sender}: {msg.text[:60]}...")

                    # 2. 先检查自动回复模式
                    auto_response = self.match_auto_reply(msg.text)
                    if auto_response:
                        self.log(f"🤖 自动回复：{auto_response}")
                        self.reply.send(msg.sender, auto_response)
                        self.mark_done(msg.text)
                        self.last_msg_text = msg.text
                        self.stats["auto_reply"] += 1
                        self.stats["total"] += 1
                        continue

                    # 3. 注入 AI CLI
                    if self.output.inject(msg.text):
                        self.log(f"✅ 已注入到 {self.output.session}")
                        # 收到确认
                        self.reply.send(msg.sender, f"✅ 收到：{msg.text[:30]}...")
                        self.mark_done(msg.text)
                        self.last_msg_text = msg.text
                        pending_text = msg.text
                        pending_contact = msg.sender
                        pending_start = time.time()
                        self.stats["ai_inject"] += 1
                        self.stats["total"] += 1
                    else:
                        self.log(f"❌ 注入失败")
                        self.reply.send(msg.sender, f"❌ 注入失败，请检查 AI CLI 状态")
                        self.stats["skipped"] += 1

                # 4. 检查 AI 是否完成
                if pending_text and pending_start:
                    elapsed = time.time() - pending_start

                    # 10 秒后开始检查完成
                    if elapsed > 10:
                        finished, output_text = self.output.is_finished()
                        if finished:
                            # 取最后 30 行作为结果
                            lines = output_text.strip().split('\n')
                            result = '\n'.join(lines[-30:])
                            if len(result) > 400:
                                result = result[:400] + "\n...(内容过长，已截断)"

                            self.reply.send_summary(pending_contact, pending_text, result, success=True)
                            self.log(f"✅ 执行完成，已发送结果")
                            pending_text = None
                            pending_start = None
                        elif elapsed > 120:  # 2 分钟超时
                            self.reply.send(pending_contact, f"⏱️ 执行超时（>2 分钟），请检查 AI CLI 状态")
                            self.log(f"⏱️ 超时")
                            pending_text = None
                            pending_start = None

                # 5. 定期打印状态
                if check_count % 20 == 0:
                    self.log(f"📊 状态：共 {self.stats['total']} | 自动回复 {self.stats['auto_reply']} | AI 注入 {self.stats['ai_inject']} | 跳过 {self.stats['skipped']}")

                time.sleep(self.check_interval)

        except KeyboardInterrupt:
            self.log(f"\n👋 已停止 (共处理 {self.stats['total']} 条)")


if __name__ == "__main__":
    watcher = Watcher()
    watcher.run()
