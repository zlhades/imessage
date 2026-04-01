"""
LLM Analyzer - Analyze incidents with LLM

Uses LangChain with Qwen/Claude for analysis.
"""

import asyncio
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage


class LLMAnalyzer:
    """Analyze incidents using LLM"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: str = "qwen-plus"
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        
        self.client = ChatOpenAI(
            openai_api_key=api_key or "sk-placeholder",
            openai_api_base=base_url,
            model_name=model,
        )
    
    async def analyze(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze messages and return analysis result"""
        
        system_prompt = """You are an incident response assistant. Analyze the conversation and determine:

1. Status: One of WAITING_INFO, INVESTIGATING, READY_TO_REPLY, READY_TO_CLOSE
2. Missing info: List of missing information (if status is WAITING_INFO)
3. Needs investigation: Boolean (if more investigation needed)
4. Suggested response: Draft response (if status is READY_TO_REPLY)

Respond in JSON format:
{
  "status": "...",
  "missingInfo": [],
  "needsInvestigation": false,
  "suggestedResponse": "..."
}"""
        
        # Format messages for LLM
        formatted_messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=str(messages))
        ]
        
        try:
            response = await self.client.ainvoke(formatted_messages)
            analysis = self._parse_response(response.content)
            return analysis
        except Exception as e:
            print(f"❌ LLM analysis error: {e}")
            return {
                "status": "ERROR",
                "error": str(e)
            }
    
    def _parse_response(self, content: str) -> Dict[str, Any]:
        """Parse LLM response"""
        import json
        try:
            # Try to parse as JSON
            return json.loads(content)
        except:
            # Fallback parsing
            return {
                "status": "WAITING_INFO",
                "missingInfo": ["More information needed"],
                "needsInvestigation": False,
                "suggestedResponse": content
            }
