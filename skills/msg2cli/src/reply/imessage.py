#!/usr/bin/env python3
"""
msg2cli - iMessage Reply

Sends iMessage replies via AppleScript.
"""

import subprocess
from typing import Dict, Any

from .base import BaseReply


class IMessageReply(BaseReply):
    """iMessage reply."""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.reply_to = config.get("reply_to", "")
        self.max_message_length = config.get("max_length", 1000)

    def send(self, contact: str, message: str) -> bool:
        """Send iMessage."""
        try:
            clean_msg = self._escape_applescript(message)
            result = subprocess.run([
                'osascript',
                '-e', 'tell application "Messages"',
                '-e', f'send "{clean_msg}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
                '-e', 'end tell'
            ], capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            return False
        except Exception:
            return False

    def send_summary(self, contact: str, original: str, result: str, success: bool = True) -> bool:
        """Send execution summary."""
        status = "Done" if success else "Failed"
        cmd_short = original[:40] + ("..." if len(original) > 40 else "")
        result_short = result[:300] + ("\n...(truncated)" if len(result) > 300 else "")

        msg = f"[{status}]\n\nCmd: {cmd_short}\n\n{result_short}"
        if len(msg) > self.max_message_length:
            msg = msg[:self.max_message_length - 10] + "..."
        return self.send(contact, msg)

    def send_error(self, contact: str, command: str, error: str) -> bool:
        """Send error notification."""
        cmd_short = command[:40] + ("..." if len(command) > 40 else "")
        err_short = error[:200]
        msg = f"[Failed]\n\nCmd: {cmd_short}\n\nErr: {err_short}"
        return self.send(contact, msg)

    def _escape_applescript(self, text: str) -> str:
        """Escape AppleScript special characters."""
        return (
            text
            .replace('\\', '\\\\')
            .replace('"', '\\"')
            .replace('$', '\\$')
            .replace('`', '\\`')
            .replace('\n', ' ')
        )

    def get_status(self) -> Dict[str, Any]:
        """Get status."""
        return {
            "enabled": self.enabled,
            "reply_to": self.reply_to,
        }
