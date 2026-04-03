#!/usr/bin/env python3
"""
msg2cli - Reply Base Class

定义 IM 回复的统一接口。
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseReply(ABC):
    """回复基类"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.enabled = config.get("enabled", False)
        self.reply_to = config.get("reply_to", "")

    @abstractmethod
    def send(self, contact: str, message: str) -> bool:
        """发送回复"""
        pass

    def send_quick(self, contact: str, text: str) -> bool:
        """发送简短回复"""
        return self.send(contact, text)

    def send_summary(self, contact: str, original: str, result: str, success: bool = True) -> bool:
        """发送执行摘要"""
        status = "✅" if success else "❌"
        summary = f"{status} 执行完成\n\n指令：{original[:50]}\n结果：{result[:200]}"
        return self.send(contact, summary)

    def send_error(self, contact: str, command: str, error: str) -> bool:
        """发送错误通知"""
        msg = f"❌ 执行失败\n\n指令：{command}\n错误：{error[:200]}"
        return self.send(contact, msg)
