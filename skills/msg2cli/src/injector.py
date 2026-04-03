#!/usr/bin/env python3
"""
msg2cli - Injector

将消息注入到 AI CLI tmux 会话。
"""

import subprocess
import time
from typing import Optional


class Injector:
    """tmux 注入器"""

    def __init__(self, session: str, prompt_suffix: str = ""):
        self.session = session
        self.prompt_suffix = prompt_suffix

    def inject(self, text: str) -> bool:
        """注入消息到 tmux 会话"""
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

    def get_output(self) -> str:
        """获取 tmux 会话输出"""
        result = subprocess.run(
            ['tmux', 'capture-pane', '-t', self.session, '-p', '-S', '-500'],
            capture_output=True, text=True
        )
        return result.stdout if result.returncode == 0 else ""

    def is_finished(self) -> tuple:
        """检查 AI 是否完成"""
        output = self.get_output()
        markers = ["? for shortcuts", "Would you like", "Type your message", "╰─", "└──", "✅ Done", "已执行"]
        for m in markers:
            if m in output:
                return True, output
        return False, output
