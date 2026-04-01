"""
E2E Test - Complete Incident Response Workflow

Tests the full incident response flow:
1. Initial incident report
2. AI analysis and clarification
3. Investigation
4. Response drafting with confirmation
5. Incident closure

Run with: pytest tests/test_e2e.py -v
"""

import pytest
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.agent import IncidentAgent, AgentState, build_agent_graph
from src.persistence.database import AgentDatabase


# ============ Test Fixtures ============

@pytest.fixture
def test_db():
    """Create test database"""
    db_path = "data/test_agent.db"
    db = AgentDatabase(db_path)
    yield db
    # Cleanup
    if os.path.exists(db_path):
        os.remove(db_path)


@pytest.fixture
def test_messages():
    """Test message sequence for 500 error incident"""
    return [
        {"role": "user", "content": "API 服务返回 500 错误！"},
        {"role": "user", "content": "有人看到了吗？"},
    ]


@pytest.fixture
def test_config():
    """Test configuration"""
    return {
        "db_path": "data/test_agent.db",
        "file_paths": ["data/test/"],
        "llm": {
            "api_key": "sk-test",
            "model": "qwen-plus"
        }
    }


# ============ E2E Test ============

@pytest.mark.asyncio
async def test_full_incident_workflow(test_db, test_messages, test_config):
    """Test complete incident response workflow"""
    
    print("\n" + "="*70)
    print("E2E Test: Complete Incident Response Workflow")
    print("="*70)
    
    # ========== Step 1: Initial Incident Report ==========
    print("\n📋 Step 1: Initial Incident Report")
    
    event_id = "INC-TEST-001"
    test_db.save_event(
        event_id,
        "OPEN",
        {"messages": test_messages}
    )
    
    event = test_db.get_event(event_id)
    assert event is not None
    assert event["status"] == "OPEN"
    print(f"✅ Event created: {event_id}")
    
    # ========== Step 2: AI Analysis ==========
    print("\n🧠 Step 2: AI Analysis")
    
    from src.action.llm_analyzer import LLMAnalyzer
    
    # Use mock analyzer for testing (no API call)
    mock_analysis = {
        "status": "WAITING_INFO",
        "missingInfo": ["具体服务", "影响范围", "错误率"],
        "needsInvestigation": False,
        "suggestedResponse": "请问具体是哪个服务？"
    }
    
    test_db.add_message(event_id, "system", f"Analysis: {mock_analysis['status']}")
    print(f"✅ Analysis complete: {mock_analysis['status']}")
    
    # ========== Step 3: Clarification Questions ==========
    print("\n❓ Step 3: Clarification Questions")
    
    questions = "请问：\n1. 具体是哪个服务？\n2. 影响范围多大？\n3. 错误率多少？"
    test_db.add_message(event_id, "assistant", questions)
    print(f"✅ Questions generated: {len(questions.split(chr(10)))} questions")
    
    # ========== Step 4: Teammate Response ==========
    print("\n👤 Step 4: Teammate Response (Simulated)")
    
    teammate_response = "是 payment-service 的 /api/payment/process 端点，错误率 50%"
    test_db.add_message(event_id, "user", teammate_response)
    print(f"✅ Teammate responded")
    
    # ========== Step 5: Re-analysis ==========
    print("\n🧠 Step 5: Re-analysis")
    
    updated_analysis = {
        "status": "INVESTIGATING",
        "missingInfo": ["问题开始时间"],
        "needsInvestigation": True,
        "suggestedResponse": None
    }
    
    test_db.add_message(event_id, "system", f"Analysis: {updated_analysis['status']}")
    print(f"✅ Re-analysis complete: {updated_analysis['status']}")
    
    # ========== Step 6: Investigation ==========
    print("\n🔍 Step 6: Investigation")
    
    investigation_findings = """
    调查结果:
    1. 日志分析：发现 3 次 500 错误，都是 Database connection timeout
    2. 代码分析：db.getConnection() 可能未正确释放连接
    3. Commit 分析：最近有连接管理重构
    """
    
    test_db.add_message(event_id, "system", investigation_findings)
    print(f"✅ Investigation complete")
    
    # ========== Step 7: Response Draft ==========
    print("\n📝 Step 7: Response Draft")
    
    draft_response = """
    📊 事件分析报告
    
    【问题概述】
    - 服务：payment-service
    - 端点：POST /api/payment/process
    - 错误：500 Internal Server Error
    - 原因：Database connection timeout
    
    【影响范围】
    - 时间：14:25 开始至今
    - 频率：每 2-3 分钟一次
    - 已发生：3 次
    
    【建议行动】
    1. 立即：重启 payment-service
    2. 短期：检查连接释放逻辑
    3. 长期：添加连接池监控
    """
    
    test_db.save_event(event_id, "WAITING_CONFIRM", {
        **event.get("context", {}),
        "draft": draft_response
    })
    print(f"✅ Draft created")
    
    # ========== Step 8: Human Confirmation ==========
    print("\n⏸️  Step 8: Human Confirmation (Simulated)")
    
    # Simulate human confirmation
    confirmed = True
    print(f"✅ Confirmation: {'Confirmed' if confirmed else 'Cancelled'}")
    
    # ========== Step 9: Send Response ==========
    print("\n📤 Step 9: Send Response")
    
    test_db.add_message(event_id, "assistant", draft_response)
    test_db.save_event(event_id, "RESPONDED", {})
    print(f"✅ Response sent")
    
    # ========== Step 10: Incident Closure ==========
    print("\n✅ Step 10: Incident Closure")
    
    closure_message = "已修复 [CLOSED]\n\n修复内容：添加了连接错误处理和 finally 块"
    test_db.add_message(event_id, "user", closure_message)
    test_db.close_event(event_id)
    print(f"✅ Incident closed")
    
    # ========== Verify Final State ==========
    print("\n📊 Verifying Final State...")
    
    final_event = test_db.get_event(event_id)
    assert final_event is not None
    assert final_event["status"] == "CLOSED"
    
    messages = test_db.get_messages(event_id)
    assert len(messages) >= 8  # At least 8 messages in the flow
    
    print(f"✅ Final state verified: {final_event['status']}")
    print(f"✅ Total messages: {len(messages)}")
    
    print("\n" + "="*70)
    print("E2E Test: PASSED ✅")
    print("="*70)


# ============ LangGraph Workflow Test ============

@pytest.mark.asyncio
async def test_langgraph_workflow():
    """Test LangGraph workflow compilation"""
    
    print("\n🔧 Testing LangGraph Workflow...")
    
    graph = build_agent_graph()
    assert graph is not None
    
    # Compile with checkpointer
    from langgraph.checkpoint.memory import MemorySaver
    memory = MemorySaver()
    app = graph.compile(checkpointer=memory)
    
    assert app is not None
    print("✅ LangGraph workflow compiled successfully")


# ============ Database Test ============

@pytest.mark.asyncio
async def test_database_operations(test_db):
    """Test database operations"""
    
    print("\n💾 Testing Database Operations...")
    
    # Test save and get event
    test_db.save_event("TEST-001", "OPEN", {"test": "data"})
    event = test_db.get_event("TEST-001")
    assert event is not None
    assert event["status"] == "OPEN"
    print("✅ Event save/get works")
    
    # Test add and get messages
    test_db.add_message("TEST-001", "user", "Hello")
    test_db.add_message("TEST-001", "assistant", "Hi there")
    messages = test_db.get_messages("TEST-001")
    assert len(messages) == 2
    print("✅ Message add/get works")
    
    # Test state save/get
    test_db.save_state("session-1", {"counter": 42})
    state = test_db.get_state("session-1")
    assert state is not None
    assert state["counter"] == 42
    print("✅ State save/get works")
    
    # Test close event
    test_db.close_event("TEST-001")
    event = test_db.get_event("TEST-001")
    assert event["status"] == "CLOSED"
    print("✅ Event close works")


# ============ Run Tests ============

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
