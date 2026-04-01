"""
Slack Sender - Send messages to Slack

Uses slack-sdk for sending messages.
"""

import asyncio
from typing import Optional, Dict, Any
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError


class SlackSender:
    """Send messages to Slack"""
    
    def __init__(
        self,
        token: Optional[str] = None
    ):
        self.token = token
        self.client = WebClient(token=token) if token else None
    
    async def send(
        self,
        channel: str,
        message: str,
        thread_ts: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send message to Slack"""
        
        if not self.client:
            print(f"⚠️  Slack not configured, would send to {channel}: {message}")
            return {"ok": True, "ts": "mock-ts"}
        
        try:
            response = self.client.chat_postMessage(
                channel=channel,
                text=message,
                thread_ts=thread_ts
            )
            print(f"✅ Message sent to {channel}")
            return {"ok": True, "ts": response["ts"]}
        except SlackApiError as e:
            print(f"❌ Failed to send message: {e}")
            return {"ok": False, "error": str(e)}
    
    async def confirm_and_send(
        self,
        channel: str,
        draft: str,
        thread_ts: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send message with confirmation (human-in-the-loop)"""
        
        # In production, this would use LangGraph interrupt()
        # For now, just send
        return await self.send(channel, draft, thread_ts)
