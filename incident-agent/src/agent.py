"""
Incident Agent - LangGraph Core

Main agent definition with StateGraph for incident response workflow.
"""

from typing import TypedDict, List, Dict, Any, Optional
from datetime import datetime
import asyncio

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver

from src.perception.file_watcher import FileWatcher
from src.perception.slack_listener import SlackListener
from src.action.llm_analyzer import LLMAnalyzer
from src.action.slack_sender import SlackSender
from src.persistence.database import AgentDatabase


# ============ State Definition ============

class AgentState(TypedDict):
    """Agent state for LangGraph"""
    messages: List[Dict[str, Any]]      # Message history
    incident: Optional[Dict[str, Any]]  # Current incident
    analysis: Optional[Dict[str, Any]]  # AI analysis result
    draft: Optional[str]                # Response draft
    confirmed: bool                     # Human confirmation
    status: str                         # Current status
    last_activity: float               # Last activity timestamp


# ============ Node Definitions ============

async def monitor_node(state: AgentState) -> AgentState:
    """Monitor for new events (files, Slack, SNARKs)"""
    print("📡 [Monitor] Checking for updates...")
    
    # Check file updates
    # Check Slack messages
    # Check SNARKs updates
    
    # For now, just return current state
    return state


async def analyze_node(state: AgentState) -> AgentState:
    """Analyze messages with LLM"""
    print("🧠 [Analyze] Analyzing messages...")
    
    if not state["messages"]:
        return {"analysis": {"status": "NO_MESSAGES"}}
    
    analyzer = LLMAnalyzer()
    analysis = await analyzer.analyze(state["messages"])
    
    return {"analysis": analysis}


async def investigate_node(state: AgentState) -> AgentState:
    """Investigate incident (logs, code, commits)"""
    print("🔍 [Investigate] Investigating incident...")
    
    # Simulate investigation
    investigation_result = {
        "logs_checked": True,
        "code_checked": True,
        "commits_checked": True,
        "findings": "Database connection pool exhausted",
    }
    
    new_messages = state["messages"] + [{
        "role": "system",
        "content": f"Investigation findings: {investigation_result['findings']}"
    }]
    
    return {
        "messages": new_messages,
        "incident": {**state.get("incident", {}), "investigation": investigation_result}
    }


async def confirm_node(state: AgentState) -> AgentState:
    """Human confirmation (interrupt point)"""
    print("⏸️  [Confirm] Waiting for human confirmation...")
    
    draft = state.get("draft", "")
    print(f"📝 Draft response:\n{draft}")
    
    # In production, this would use langgraph.graph.interrupt()
    # For now, simulate confirmation
    confirmed = True  # Simulated
    
    return {"confirmed": confirmed}


async def respond_node(state: AgentState) -> AgentState:
    """Send response"""
    print("📤 [Respond] Sending response...")
    
    draft = state.get("draft", "")
    
    # Send to Slack / Write to file
    sender = SlackSender()
    await sender.send(channel="#incidents", message=draft)
    
    return {"status": "RESPONDED"}


async def close_node(state: AgentState) -> AgentState:
    """Close incident"""
    print("✅ [Close] Closing incident...")
    
    # Generate summary
    # Update database
    # Close incident
    
    return {"status": "CLOSED"}


# ============ Edge Functions ============

def should_investigate(state: AgentState) -> str:
    """Decide if investigation is needed"""
    analysis = state.get("analysis", {})
    if analysis.get("needsInvestigation", False):
        return "investigate"
    return "analyze_more"


def route_analysis(state: AgentState) -> str:
    """Route based on analysis result"""
    analysis = state.get("analysis", {})
    status = analysis.get("status", "")
    
    if status == "WAITING_INFO":
        return "monitor"  # Need more info, continue monitoring
    elif status == "INVESTIGATING":
        return "investigate"
    elif status == "READY_TO_REPLY":
        return "confirm"
    elif status == "READY_TO_CLOSE":
        return "close"
    else:
        return "monitor"


# ============ Build Workflow ============

def build_agent_graph() -> StateGraph:
    """Build the agent workflow graph"""
    
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("monitor", monitor_node)
    workflow.add_node("analyze", analyze_node)
    workflow.add_node("investigate", investigate_node)
    workflow.add_node("confirm", confirm_node)
    workflow.add_node("respond", respond_node)
    workflow.add_node("close", close_node)
    
    # Set entry point
    workflow.set_entry_point("monitor")
    
    # Add edges
    workflow.add_edge("monitor", "analyze")
    
    # Conditional edges from analyze
    workflow.add_conditional_edges(
        "analyze",
        route_analysis,
        {
            "monitor": "monitor",
            "investigate": "investigate",
            "confirm": "confirm",
            "close": "close",
        }
    )
    
    # Investigation loops back to analysis
    workflow.add_edge("investigate", "analyze")
    
    # Confirmation flow
    workflow.add_edge("confirm", "respond")
    
    # After response, continue monitoring
    workflow.add_edge("respond", "monitor")
    
    # Close ends the flow
    workflow.add_edge("close", END)
    
    return workflow


# ============ Agent Class ============

class IncidentAgent:
    """Main Incident Agent class"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db = AgentDatabase(config.get("db_path", "data/agent.db"))
        self.graph = self._build_graph()
        self.running = False
        
        # Initialize perception layer
        self.file_watcher = FileWatcher(
            paths=config.get("file_paths", ["data/"]),
            on_change=self._on_file_change
        )
        
        self.slack_listener = SlackListener(
            token=config.get("slack_token"),
            on_message=self._on_slack_message
        )
        
        # Initialize action layer
        self.analyzer = LLMAnalyzer(
            api_key=config.get("llm_api_key"),
            model=config.get("llm_model", "qwen-plus")
        )
        
        self.sender = SlackSender(
            token=config.get("slack_token")
        )
    
    def _build_graph(self) -> StateGraph:
        """Build LangGraph workflow"""
        return build_agent_graph()
    
    def _on_file_change(self, path: str):
        """Handle file change event"""
        print(f"📁 File changed: {path}")
        # Add to message queue
    
    def _on_slack_message(self, message: Dict):
        """Handle Slack message event"""
        print(f"💬 Slack message: {message}")
        # Add to message queue
    
    async def start(self):
        """Start the agent"""
        print("🚀 Starting Incident Agent...")
        
        # Start perception layer
        await self.file_watcher.start()
        await self.slack_listener.start()
        
        # Start main loop
        self.running = True
        await self.main_loop()
    
    async def stop(self):
        """Stop the agent"""
        print("🛑 Stopping Incident Agent...")
        self.running = False
        await self.file_watcher.stop()
        await self.slack_listener.stop()
    
    async def main_loop(self):
        """Main agent loop"""
        config = {"configurable": {"thread_id": "incident-main"}}
        
        while self.running:
            try:
                # Run one iteration of the graph
                async for event in self.graph.astream({}, config):
                    print(f"📊 Event: {event}")
                
                # Wait before next iteration
                await asyncio.sleep(5)  # 5 seconds
                
            except Exception as e:
                print(f"❌ Error in main loop: {e}")
                await asyncio.sleep(5)
    
    async def process_incident(self, incident_id: str):
        """Process a specific incident"""
        config = {"configurable": {"thread_id": incident_id}}
        
        async for event in self.graph.astream({}, config):
            yield event


# ============ Main Entry Point ============

async def main():
    """Main entry point"""
    import yaml
    from pathlib import Path
    
    # Load config
    config_path = Path("config/agent.yaml")
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
    else:
        config = {
            "db_path": "data/agent.db",
            "file_paths": ["data/"],
            "llm_model": "qwen-plus",
        }
    
    # Create and start agent
    agent = IncidentAgent(config)
    
    try:
        await agent.start()
    except KeyboardInterrupt:
        await agent.stop()


if __name__ == "__main__":
    asyncio.run(main())
