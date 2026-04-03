#!/usr/bin/env python3
"""
msg2cli - Watcher

Polls input for new messages, injects into AI CLI, and sends replies.

Workflow:
1. Poll for new messages
2. Match auto-reply patterns (if matched, reply directly)
3. Otherwise inject into AI CLI
4. Wait for execution, send result reply
"""

import os
import sys
import time
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from input.base import BaseInput, Message
from output.base import BaseOutput
from reply.base import BaseReply


def load_config(config_path: str) -> Dict[str, Any]:
    """Load YAML config."""
    import yaml
    with open(config_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def create_input(config: Dict[str, Any]) -> BaseInput:
    """Create input source from config."""
    from input.imessage import IMessageInput
    return IMessageInput(config)


def create_output(config: Dict[str, Any]) -> BaseOutput:
    """Create output target from config."""
    from output.qwen import QwenOutput
    return QwenOutput(config)


def create_reply(config: Dict[str, Any]) -> BaseReply:
    """Create reply module from config."""
    from reply.imessage import IMessageReply
    return IMessageReply(config)


class Watcher:
    """Message watcher."""

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

        imessage_config = self.config["inputs"]["imessage"]
        output_name = self.config["routing"].get("default_output", "qwen")
        output_config = self.config["outputs"].get(output_name, {})
        reply_config = self.config.get("reply", {}).get("imessage", {})

        self.input: BaseInput = create_input(imessage_config)
        self.output: BaseOutput = create_output(output_config)
        self.reply: BaseReply = create_reply(reply_config)
        self.check_interval = imessage_config.get("check_interval", 3)

        # Auto-reply patterns from config
        self.auto_patterns: List[Tuple[str, str]] = []
        for rule in reply_config.get("auto_reply_patterns", []):
            pattern = rule.get("pattern", "")
            response = rule.get("response", "")
            if pattern and response:
                self.auto_patterns.append((pattern, response))

        # Load processed messages
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
        """Match auto-reply patterns."""
        for pattern, response in self.auto_patterns:
            if pattern in text:
                return response
        return None

    def is_new_message(self, msg: Message) -> bool:
        """Check if this is a new message."""
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
        """Mark message as processed."""
        self.done.add(text)
        if len(self.done) > 1000:
            self.done = set(list(self.done)[-500:])
        try:
            with open(self.done_file, 'w') as f:
                f.write('\n'.join(self.done))
        except OSError:
            pass

    def mark_reply_done(self, contact: str, original_text: str, reply_text: str):
        """Mark both original and reply text as done, to prevent loop.

        When the bot sends a reply via AppleScript, the reply may appear
        in the iMessage DB as a new message (is_from_me=0). We save both
        the original and a truncated reply prefix to the done set.
        """
        self.done.add(original_text)
        # Save reply prefix so we skip the reply when it appears in DB
        reply_prefix = reply_text[:60]
        self.done.add(reply_prefix)
        self.done.add(reply_text)
        if len(self.done) > 1000:
            self.done = set(list(self.done)[-500:])
        try:
            with open(self.done_file, 'w') as f:
                f.write('\n'.join(self.done))
        except OSError:
            pass

    def run(self):
        """Start listening."""
        self.log("=" * 35)
        self.log("  msg2cli Watcher")
        self.log("=" * 35)
        self.log(f"Input: iMessage ({', '.join(self.input.contacts)})")
        self.log(f"Output: {self.output.__class__.__name__}")
        self.log(f"Reply: {self.reply.reply_to if self.reply else 'N/A'}")
        self.log(f"Auto-reply rules: {len(self.auto_patterns)}")
        self.log(f"Poll interval: {self.check_interval}s")

        last = self.input.get_last_message()
        if last:
            self.last_msg_text = last.text
            self.log(f"Initial message: {last.text[:50]}...")

        self.log("Starting watcher...")
        pending_text = None
        pending_contact = None
        pending_start = None
        check_count = 0

        try:
            while True:
                check_count += 1

                # 1. Check new messages
                msg = self.input.get_last_message()
                if msg and self.is_new_message(msg):
                    self.log(f"\nNew message from {msg.sender}: {msg.text[:60]}...")

                    # 2. Check auto-reply patterns first
                    auto_response = self.match_auto_reply(msg.text)
                    if auto_response:
                        self.log(f"Auto-reply: {auto_response}")
                        self.reply.send(msg.sender, auto_response)
                        self.mark_done(msg.text)
                        self.last_msg_text = msg.text
                        self.stats["auto_reply"] += 1
                        self.stats["total"] += 1
                        continue

                    # 3. Inject into AI CLI
                    if self.output.inject(msg.text):
                        self.log(f"Injected into {self.output.session}")
                        reply_text = f"✅ Received: {msg.text[:30]}..."
                        self.reply.send(msg.sender, reply_text)
                        self.mark_reply_done(msg.sender, msg.text, reply_text)
                        self.last_msg_text = msg.text
                        pending_text = msg.text
                        pending_contact = msg.sender
                        pending_start = time.time()
                        self.stats["ai_inject"] += 1
                        self.stats["total"] += 1
                    else:
                        self.log("Injection failed")
                        reply_text = "❌ Injection failed. Check AI CLI status"
                        self.reply.send(msg.sender, reply_text)
                        self.mark_reply_done(msg.sender, msg.text, reply_text)
                        self.stats["skipped"] += 1

                # 4. Check if AI finished
                if pending_text and pending_start:
                    elapsed = time.time() - pending_start

                    if elapsed > 10:
                        finished, output_text = self.output.is_finished()
                        if finished:
                            lines = output_text.strip().split('\n')
                            result = '\n'.join(lines[-30:])
                            if len(result) > 400:
                                result = result[:400] + "\n...(truncated)"

                            self.reply.send_summary(pending_contact, pending_text, result, success=True)
                            self.log("Execution complete, result sent")
                            pending_text = None
                            pending_start = None
                        elif elapsed > 120:
                            reply_text = "⏱️ Timeout: >2 minutes, check AI CLI status"
                            self.reply.send(pending_contact, reply_text)
                            self.mark_reply_done(pending_contact, pending_text, reply_text)
                            self.log("Timeout")
                            pending_text = None
                            pending_start = None

                # 5. Periodic status log
                if check_count % 20 == 0:
                    self.log(f"Stats: total={self.stats['total']} auto={self.stats['auto_reply']} ai={self.stats['ai_inject']} skip={self.stats['skipped']}")

                time.sleep(self.check_interval)

        except KeyboardInterrupt:
            self.log(f"\nStopped (total processed: {self.stats['total']})")


if __name__ == "__main__":
    watcher = Watcher()
    watcher.run()
