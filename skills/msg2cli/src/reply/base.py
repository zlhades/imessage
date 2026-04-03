#!/usr/bin/env python3
"""
msg2cli - Reply Base Class

Defines the unified interface for IM reply.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseReply(ABC):
    """Reply base class."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.enabled = config.get("enabled", False)
        self.reply_to = config.get("reply_to", "")

    @abstractmethod
    def send(self, contact: str, message: str) -> bool:
        """Send reply."""
        pass

    def send_quick(self, contact: str, text: str) -> bool:
        """Send short reply."""
        return self.send(contact, text)

    def send_summary(self, contact: str, original: str, result: str, success: bool = True) -> bool:
        """Send execution summary."""
        status = "✅ Done" if success else "❌ Failed"
        summary = f"{status}\n\nCommand: {original[:50]}\nResult: {result[:200]}"
        return self.send(contact, summary)

    def send_error(self, contact: str, command: str, error: str) -> bool:
        """Send error notification."""
        msg = f"❌ Failed\n\nCommand: {command}\nError: {error[:200]}"
        return self.send(contact, msg)
