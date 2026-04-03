#!/usr/bin/env python3
"""
msg2cli - iMessage Reply

通过 AppleScript 发送 iMessage 回复。
"""

import subprocess
from typing import Dict, Any

from .base import BaseReply


class IMessageReply(BaseReply):
    """iMessage 回复"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

    def send(self, contact: str, message: str) -> bool:
        """发送 iMessage"""
        try:
            clean_msg = message.replace('"', '\\"').replace('$', '\\$').replace('`', '\\`').replace('\n', ' ')
            result = subprocess.run([
                'osascript',
                '-e', 'tell application "Messages"',
                '-e', f'send "{clean_msg}" to buddy "{contact}" of (service 1 whose service type is iMessage)',
                '-e', 'end tell'
            ], capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except Exception:
            return False
