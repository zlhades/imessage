#!/usr/bin/env python3
"""
msg2cli - Qwen Output

通过 tmux 注入到 Qwen Code CLI。
"""

import subprocess
import time
import re
from typing import Dict, Any, Tuple, List

from .base import BaseOutput


class QwenOutput(BaseOutput):
    """Qwen Code 输出"""

    # 完成标记 — 优先级从高到低
    FINISHED_MARKERS = [
        # Qwen Code 标准提示符
        "for shortcuts",
        "Would you like",
        "Type your message",
        # 中文提示
        "已执行",
        "执行完成",
        "执行完毕",
        # 常见 CLI 结束标志
        "✅ Done",
        "Command completed",
        # 错误提示（也算完成）
        "Error:",
        "Exception:",
        "Command not found",
    ]

    # 错误标记
    ERROR_MARKERS = [
        "Error:",
        "Exception:",
        "Traceback (most recent call last)",
        "Command not found",
        "Permission denied",
    ]

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.session = config.get("session", "ai_cli")
        self.command = config.get("command", "qwen")
        self.prompt_suffix = config.get("prompt_suffix", "")
        self.capture_lines = config.get("capture_lines", 500)
        self.min_wait_seconds = config.get("min_wait", 5)
        self.finished_markers = config.get("finished_markers", self.FINISHED_MARKERS)
        self.error_markers = config.get("error_markers", self.ERROR_MARKERS)
        self._inject_time: float = 0

    def inject(self, text: str) -> bool:
        """注入消息到 Qwen Code tmux 会话"""
        # 检查 tmux 会话是否存在
        if not self._session_exists():
            return False

        full = f"{text}\n{self.prompt_suffix}" if self.prompt_suffix else text

        # 清除当前输入
        self._send_keys('C-c')
        time.sleep(0.2)

        # 逐行输入
        for line in full.split('\n'):
            self._send_keys(line)
            time.sleep(0.03)

        # 按回车执行
        self._send_keys('Enter')
        time.sleep(0.3)

        self._inject_time = time.time()
        return True

    def is_finished(self) -> Tuple[bool, str]:
        """检查 AI 是否完成

        返回:
            (finished: bool, output: str)
        """
        # 至少等待 min_wait 秒
        if self._inject_time and (time.time() - self._inject_time) < self.min_wait_seconds:
            return False, ""

        output = self.get_output()
        if not output.strip():
            return False, ""

        # 检查完成标记
        for marker in self.finished_markers:
            if marker in output:
                return True, output

        return False, output

    def is_error(self, output: str) -> bool:
        """检查输出是否包含错误"""
        return any(m in output for m in self.error_markers)

    def get_output(self) -> str:
        """获取 tmux 会话输出（最后 N 行）"""
        result = subprocess.run(
            ['tmux', 'capture-pane', '-t', self.session, '-p', '-S', f'-{self.capture_lines}'],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout if result.returncode == 0 else ""

    def get_last_lines(self, n: int = 30) -> str:
        """获取最后 N 行输出"""
        output = self.get_output()
        if not output:
            return ""
        lines = output.strip().split('\n')
        return '\n'.join(lines[-n:])

    def _session_exists(self) -> bool:
        """检查 tmux 会话是否存在"""
        result = subprocess.run(
            ['tmux', 'has-session', '-t', self.session],
            capture_output=True, timeout=5
        )
        return result.returncode == 0

    def _send_keys(self, keys: str) -> bool:
        """发送按键到 tmux 会话"""
        result = subprocess.run(
            ['tmux', 'send-keys', '-t', self.session, keys],
            capture_output=True, timeout=5
        )
        return result.returncode == 0

    def get_status(self) -> Dict[str, Any]:
        """获取当前状态"""
        exists = self._session_exists()
        output = self.get_output() if exists else ""
        is_error = self.is_error(output)

        return {
            "session": self.session,
            "exists": exists,
            "enabled": self.enabled,
            "error": is_error,
            "output_lines": len(output.split('\n')) if output else 0,
            "output_preview": output[-200:] if output else "",
        }
