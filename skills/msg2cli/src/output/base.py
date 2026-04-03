#!/usr/bin/env python3
"""
msg2cli - Output Base Class

Defines the unified interface for AI CLI output targets.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any
from dataclasses import dataclass


@dataclass
class ExecutionResult:
    """Execution result."""
    success: bool
    output: str
    error: str = ""
    duration: float = 0.0


class BaseOutput(ABC):
    """AI CLI output base class."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.enabled = config.get("enabled", False)
        self.type = config.get("type", "tmux")
        self.session = config.get("session", "ai_cli")
        self.command = config.get("command", "")
        self.prompt_suffix = config.get("prompt_suffix", "")

    @abstractmethod
    def inject(self, text: str) -> bool:
        """Inject message into AI CLI."""
        pass

    @abstractmethod
    def is_finished(self) -> tuple:
        """Check if AI has finished, returns (finished, output)."""
        pass

    @abstractmethod
    def get_output(self) -> str:
        """Get AI output."""
        pass
