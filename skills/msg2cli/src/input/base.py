#!/usr/bin/env python3
"""
msg2cli - Input Base Class

Defines the unified interface for input sources.
All input sources (iMessage, etc.) must inherit from this class.
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass


@dataclass
class Message:
    """Message object."""
    id: Any
    text: str
    sender: str
    timestamp: Any
    is_from_me: bool = False

    def __repr__(self):
        return f"Message(id={self.id}, sender={self.sender}, text={self.text[:30]}...)"


class BaseInput(ABC):
    """Input source base class."""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.contacts = self.config.get("contacts", [])

    @abstractmethod
    def get_last_message(self) -> Optional[Message]:
        """Get the last message."""
        pass

    @abstractmethod
    def search_messages(self, contact: str, limit: int = 10) -> List[Message]:
        """Search messages."""
        pass

    @abstractmethod
    def get_contacts(self) -> List[Dict[str, str]]:
        """Get contact list."""
        pass

    def is_auto_message(self, text: str, markers: List[str]) -> bool:
        """Check if message is an auto-reply (loop prevention)."""
        return any(m in text for m in markers)
