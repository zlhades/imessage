#!/usr/bin/env python3
"""
msg2cli - Slack Input (预留)

从 Slack 读取消息。
"""

from typing import Optional, List, Dict, Any
from .base import BaseInput, Message


class SlackInput(BaseInput):
    """Slack 输入源（预留）"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.token = config.get("token", "")
        self.channels = config.get("channels", [])

    def get_last_message(self) -> Optional[Message]:
        raise NotImplementedError("Slack 输入源尚未实现")

    def search_messages(self, contact: str, limit: int = 10) -> List[Message]:
        raise NotImplementedError("Slack 输入源尚未实现")

    def get_contacts(self) -> List[Dict[str, str]]:
        raise NotImplementedError("Slack 输入源尚未实现")
