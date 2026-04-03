#!/usr/bin/env python3
"""
msg2cli - Qwen Output

Injects messages into Qwen Code CLI via tmux.
"""

import subprocess
import time
from typing import Dict, Any, Tuple

from .base import BaseOutput


class QwenOutput(BaseOutput):
    """Qwen Code output."""

    FINISHED_MARKERS = [
        "for shortcuts",
        "Would you like",
        "Type your message",
        "Command completed",
        "Error:",
        "Exception:",
        "Command not found",
    ]

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
        """Inject message into Qwen Code tmux session."""
        if not self._session_exists():
            return False

        full = f"{text}\n{self.prompt_suffix}" if self.prompt_suffix else text

        self._send_keys('C-c')
        time.sleep(0.2)

        for line in full.split('\n'):
            self._send_keys(line)
            time.sleep(0.03)

        self._send_keys('Enter')
        time.sleep(0.3)

        self._inject_time = time.time()
        return True

    def is_finished(self) -> Tuple[bool, str]:
        """Check if AI has completed.

        Returns:
            (finished: bool, output: str)
        """
        if self._inject_time and (time.time() - self._inject_time) < self.min_wait_seconds:
            return False, ""

        output = self.get_output()
        if not output.strip():
            return False, ""

        for marker in self.finished_markers:
            if marker in output:
                return True, output

        return False, output

    def is_error(self, output: str) -> bool:
        """Check if output contains errors."""
        return any(m in output for m in self.error_markers)

    def get_output(self) -> str:
        """Get tmux session output (last N lines)."""
        result = subprocess.run(
            ['tmux', 'capture-pane', '-t', self.session, '-p', '-S', f'-{self.capture_lines}'],
            capture_output=True, text=True, timeout=5
        )
        return result.stdout if result.returncode == 0 else ""

    def get_last_lines(self, n: int = 30) -> str:
        """Get last N lines of output."""
        output = self.get_output()
        if not output:
            return ""
        lines = output.strip().split('\n')
        return '\n'.join(lines[-n:])

    def _session_exists(self) -> bool:
        """Check if tmux session exists."""
        result = subprocess.run(
            ['tmux', 'has-session', '-t', self.session],
            capture_output=True, timeout=5
        )
        return result.returncode == 0

    def _send_keys(self, keys: str) -> bool:
        """Send keys to tmux session."""
        result = subprocess.run(
            ['tmux', 'send-keys', '-t', self.session, keys],
            capture_output=True, timeout=5
        )
        return result.returncode == 0

    def get_status(self) -> Dict[str, Any]:
        """Get current status."""
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
