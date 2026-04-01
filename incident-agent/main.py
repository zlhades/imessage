#!/usr/bin/env python3
"""
Incident Agent - Main Entry Point

Run with: python main.py
"""

import asyncio
import yaml
from pathlib import Path
from src.agent import IncidentAgent


async def main():
    """Main entry point"""
    print("🚀 Incident Agent Starting...")
    
    # Load configuration
    config_path = Path("config/agent.yaml")
    if config_path.exists():
        with open(config_path) as f:
            config = yaml.safe_load(f)
        print(f"✅ Loaded configuration from {config_path}")
    else:
        config = {
            "db_path": "data/agent.db",
            "file_paths": ["data/"],
            "llm": {
                "api_key": None,
                "model": "qwen-plus"
            }
        }
        print("⚠️  Using default configuration")
    
    # Create agent
    agent = IncidentAgent(config)
    
    # Handle graceful shutdown
    import signal
    
    def signal_handler(sig, frame):
        print("\n🛑 Shutting down...")
        asyncio.create_task(agent.stop())
    
    signal.signal(signal.SIGINT, signal_handler)
    
    # Start agent
    try:
        await agent.start()
    except KeyboardInterrupt:
        await agent.stop()
    except Exception as e:
        print(f"❌ Error: {e}")
        await agent.stop()


if __name__ == "__main__":
    asyncio.run(main())
