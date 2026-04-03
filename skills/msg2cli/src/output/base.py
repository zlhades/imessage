#!/usr/bin/env python3
"""
msg2cli - Output Base Class

定义 AI CLI 输出的统一接口。
所有输出目标（Qwen/CodeX/CloudCode）需继承此类。
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ExecutionResult:
    """执行结果"""
    success: bool
    output: str
    error: str = ""
    duration: float = 0.0


class BaseOutput(ABC):
    """AI CLI 输出基类"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.enabled = config.get("enabled", False)
        self.type = config.get("type", "tmux")
        self.session = config.get("session", "ai_cli")
        self.command = config.get("command", "")
        self.prompt_suffix = config.get("prompt_suffix", "")

    @abstractmethod
    def inject(self, text: str) -> bool:
        """将消息注入到 AI CLI"""
        pass

    @abstractmethod
    def is_finished(self) -> tuple:
        """检查 AI 是否完成执行，返回 (finished, output)"""
        pass

    @abstractmethod
    def get_output(self) -> str:
        """获取 AI 的输出"""
        pass
