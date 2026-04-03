#!/usr/bin/env python3
"""
msg2cli - Injector

Injects messages into AI CLI tmux session.
"""

import subprocess
import time
from typing import Optional


class Injector:
    """tmux injector."""

    def __init__(self, session: str, prompt_suffix: str = ""):
        self.session = session
        self.prompt_suffix = prompt_suffix

    def inject(self, text: str) -> bool:
        """Inject message into tmux session."""
        if subprocess.run(['tmux', 'has-session', '-t', self.session], capture_output=True).returncode != 0:
            return False

        full = f"{text}\n{self.prompt_suffix}" if self.prompt_suffix else text

        subprocess.run(['tmux', 'send-keys', '-t', self.session, 'C-c'], capture_output=True)
        time.sleep(0.2)

        for line in full.split('\n'):
            subprocess.run(['tmux', 'send-keys', '-t', self.session, line + '\n'], capture_output=True)
            time.sleep(0.03)

        time.sleep(0.3)
        subprocess.run(['tmux', 'send-keys', '-t', self.session, 'Enter'], capture_output=True)
        return True

    def get_output(self) -> str:
        """Get tmux session output."""
        result = subprocess.run(
            ['tmux', 'capture-pane', '-t', self.session, '-p', '-S', '-500'],
            capture_output=True, text=True
        )
        return result.stdout if result.returncode == 0 else ""

    def is_finished(self) -> tuple:
        """Check if AI has finished."""
        output = self.get_output()
        markers = ["? for shortcuts", "Would you like", "Type your message", "Done"]
        for m in markers:
            if m in output:
                return True, output
        return False, output
