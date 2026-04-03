#!/usr/bin/env python3
"""
msg2cli - CodeX Output (预留)

通过 tmux 注入到 CodeX CLI。
"""

from typing import Dict, Any, Tuple
from .base import BaseOutput


class CodeXOutput(BaseOutput):
    """CodeX 输出（预留）"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)

    def inject(self, text: str) -> bool:
        raise NotImplementedError("CodeX 输出尚未实现")

    def is_finished(self) -> Tuple[bool, str]:
        raise NotImplementedError("CodeX 输出尚未实现")

    def get_output(self) -> str:
        raise NotImplementedError("CodeX 输出尚未实现")
