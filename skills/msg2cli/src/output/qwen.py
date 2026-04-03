#!/usr/bin/env python3
"""
msg2cli - Qwen Output

通过 tmux 注入到 Qwen Code CLI。
"""

import subprocess
import time
from typing import Dict, Any, Tuple

from .base import BaseOutput


class QwenOutput(BaseOutput):
    """Qwen Code 输出"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.command = config.get("command", "qwen")

    def inject(self, text: str) -> bool:
        """注入消息到 Qwen Code tmux 会话"""
        if subprocess.run(['tmux', 'has-session', '-t', self.session], capture_output=True).returncode != 0:
            return False

        full = f"{text}\n{self.prompt_suffix}" if self.prompt_suffix else text

        # 清除当前输入
        subprocess.run(['tmux', 'send-keys', '-t', self.session, 'C-c'], capture_output=True)
        time.sleep(0.2)

        # 逐行输入
        for line in full.split('\n'):
            subprocess.run(['tmux', 'send-keys', '-t', self.session, line + '\n'], capture_output=True)
            time.sleep(0.03)

        time.sleep(0.3)
        subprocess.run(['tmux', 'send-keys', '-t', self.session, 'Enter'], capture_output=True)
        return True

    def is_finished(self) -> Tuple[bool, str]:
        """检查 Qwen 是否完成"""
        output = self.get_output()
        markers = ["? for shortcuts", "Would you like", "Type your message", "╰─", "└──", "✅ Done", "已执行"]
        for m in markers:
            if m in output:
                return True, output
        return False, output

    def get_output(self) -> str:
        """获取 tmux 会话输出"""
        result = subprocess.run(
            ['tmux', 'capture-pane', '-t', self.session, '-p', '-S', '-500'],
            capture_output=True, text=True
        )
        return result.stdout if result.returncode == 0 else ""
