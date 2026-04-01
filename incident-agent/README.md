# Incident Agent - Python + LangGraph

AI-driven incident response agent with:
- Long-running monitoring
- Active information gathering
- Rule-based decision engine
- Human-in-the-loop confirmation
- State persistence

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run agent
python main.py

# Run tests
pytest tests/ -v
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Incident Agent (Python)          │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  LangGraph StateGraph              │ │
│  │  - monitor → analyze → confirm     │ │
│  │  - Human-in-the-loop               │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Perception Layer                   │ │
│  │  - File Watcher (watchdog)         │ │
│  │  - Slack Listener                  │ │
│  │  - SNARKs Fetcher                  │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Action Layer                       │ │
│  │  - LLM Analyzer (LangChain)        │ │
│  │  - Slack Sender                    │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Persistence Layer                  │ │
│  │  - SQLite Database                 │ │
│  │  - Vector Store (chromadb)         │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Project Structure

```
incident-agent/
├── src/
│   ├── agent.py              # LangGraph agent core
│   ├── perception/           # Perception layer
│   ├── cognition/            # Cognition layer
│   ├── action/               # Action layer
│   └── persistence/          # Persistence layer
├── tests/
│   ├── test_agent.py         # Agent tests
│   └── test_e2e.py           # E2E tests
├── config/
│   ├── agent.yaml
│   └── rules.yaml
├── main.py
├── requirements.txt
└── README.md
```
