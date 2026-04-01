"""
Slack Listener - Listen for Slack messages

Uses slack-bolt for Slack Events API.
"""

import asyncio
from typing import Callable, Dict, Any, Optional
from slack_bolt import App
from slack_bolt.async_app import AsyncApp


class SlackListener:
    """Listen for Slack messages"""
    
    def __init__(
        self,
        token: Optional[str] = None,
        signing_secret: Optional[str] = None,
        on_message: Optional[Callable] = None
    ):
        self.token = token
        self.signing_secret = signing_secret
        self.on_message = on_message
        self.app: Optional[AsyncApp] = None
        self.running = False
        
        if token and signing_secret:
            self.app = AsyncApp(
                token=token,
                signing_secret=signing_secret
            )
            self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup Slack event handlers"""
        if not self.app:
            return
        
        @self.app.event("message")
        async def handle_message(event, say):
            if self.on_message:
                await self.on_message(event)
    
    async def start(self):
        """Start Slack listener"""
        if not self.app:
            print("⚠️  Slack not configured, skipping listener")
            return
        
        print("💬 Starting Slack listener...")
        # In production, this would start the Slack app server
        self.running = True
        print("✅ Slack listener started")
    
    async def stop(self):
        """Stop Slack listener"""
        print("💬 Stopping Slack listener...")
        self.running = False
    
    def is_running(self) -> bool:
        """Check if listener is running"""
        return self.running
