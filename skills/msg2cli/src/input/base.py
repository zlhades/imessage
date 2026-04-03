#!/usr/bin/env python3
"""
msg2cli - Input Base Class

定义输入源的统一接口。
所有输入源（iMessage/Slack/微信等）需继承此类并实现相应方法。
"""

from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass


@dataclass
class Message:
    """消息对象"""
    id: Any
    text: str
    sender: str
    timestamp: Any
    is_from_me: bool = False

    def __repr__(self):
        return f"Message(id={self.id}, sender={self.sender}, text={self.text[:30]}...)"


class BaseInput(ABC):
    """输入源基类"""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.contacts = self.config.get("contacts", [])

    @abstractmethod
    def get_last_message(self) -> Optional[Message]:
        """获取最后一条消息"""
        pass

    @abstractmethod
    def search_messages(self, contact: str, limit: int = 10) -> List[Message]:
        """搜索消息"""
        pass

    @abstractmethod
    def get_contacts(self) -> List[Dict[str, str]]:
        """获取联系人列表"""
        pass

    def is_auto_message(self, text: str, markers: List[str]) -> bool:
        """判断是否为自动回复消息（用于防死循环）"""
        return any(m in text for m in markers)
