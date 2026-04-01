"""
Simple E2E Test - Without external dependencies

This test verifies the core logic without requiring API keys or external services.
"""

import pytest
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.persistence.database import AgentDatabase
import os


# ============ Test Fixtures ============

@pytest.fixture
def test_db():
    """Create test database"""
    db_path = "data/test_simple.db"
    db = AgentDatabase(db_path)
    yield db
    # Cleanup
    if os.path.exists(db_path):
        os.remove(db_path)


# ============ Tests ============

def test_database_init(test_db):
    """Test database initialization"""
    print("\n💾 Testing Database Initialization...")
    assert test_db is not None
    print("✅ Database initialized")


def test_save_and_get_event(test_db):
    """Test saving and retrieving events"""
    print("\n📋 Testing Event Save/Get...")
    
    test_db.save_event("TEST-001", "OPEN", {"test": "data"})
    event = test_db.get_event("TEST-001")
    
    assert event is not None
    assert event["status"] == "OPEN"
    assert event["context"]["test"] == "data"
    print("✅ Event save/get works")


def test_add_and_get_messages(test_db):
    """Test adding and retrieving messages"""
    print("\n💬 Testing Message Add/Get...")
    
    test_db.add_message("TEST-001", "user", "API 错误！")
    test_db.add_message("TEST-001", "assistant", "正在调查...")
    
    messages = test_db.get_messages("TEST-001")
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    print("✅ Message add/get works")


def test_save_and_get_state(test_db):
    """Test saving and retrieving state"""
    print("\n💾 Testing State Save/Get...")
    
    test_db.save_state("session-1", {"counter": 42, "status": "monitoring"})
    state = test_db.get_state("session-1")
    
    assert state is not None
    assert state["counter"] == 42
    assert state["status"] == "monitoring"
    print("✅ State save/get works")


def test_close_event(test_db):
    """Test closing an event"""
    print("\n✅ Testing Event Close...")
    
    test_db.save_event("TEST-002", "OPEN", {})
    test_db.close_event("TEST-002")
    
    event = test_db.get_event("TEST-002")
    assert event is not None
    assert event["status"] == "CLOSED"
    print("✅ Event close works")


def test_get_pending_events(test_db):
    """Test getting pending events"""
    print("\n📋 Testing Pending Events...")
    
    test_db.save_event("PENDING-001", "OPEN", {})
    test_db.save_event("PENDING-002", "INVESTIGATING", {})
    test_db.save_event("CLOSED-001", "CLOSED", {})
    
    pending = test_db.get_pending_events()
    assert len(pending) == 2  # Only OPEN and INVESTIGATING
    print(f"✅ Got {len(pending)} pending events")


def test_full_workflow(test_db):
    """Test complete incident workflow"""
    print("\n" + "="*60)
    print("Testing Full Incident Workflow")
    print("="*60)
    
    # Step 1: Create event
    print("\n1️⃣  Create Event")
    test_db.save_event("INC-001", "OPEN", {
        "messages": [
            {"role": "user", "content": "API 500 错误"}
        ]
    })
    
    # Step 2: Add analysis
    print("2️⃣  Add Analysis")
    test_db.add_message("INC-001", "system", "Analysis: WAITING_INFO")
    
    # Step 3: Add questions
    print("3️⃣  Generate Questions")
    test_db.add_message("INC-001", "assistant", "请问具体是哪个服务？")
    
    # Step 4: Add response
    print("4️⃣  Teammate Response")
    test_db.add_message("INC-001", "user", "payment-service")
    
    # Step 5: Update status
    print("5️⃣  Update Status")
    test_db.save_event("INC-001", "INVESTIGATING", {})
    
    # Step 6: Investigation
    print("6️⃣  Investigation")
    test_db.add_message("INC-001", "system", "调查结果：连接池满")
    
    # Step 7: Draft response
    print("7️⃣  Draft Response")
    test_db.save_event("INC-001", "WAITING_CONFIRM", {
        "draft": "建议重启服务"
    })
    
    # Step 8: Confirm and send
    print("8️⃣  Confirm and Send")
    test_db.add_message("INC-001", "assistant", "建议重启服务")
    test_db.save_event("INC-001", "RESPONDED", {})
    
    # Step 9: Close
    print("9️⃣  Close Incident")
    test_db.add_message("INC-001", "user", "已修复 [CLOSED]")
    test_db.close_event("INC-001")
    
    # Verify
    print("\n📊 Verify Final State")
    event = test_db.get_event("INC-001")
    assert event is not None
    assert event["status"] == "CLOSED"
    
    messages = test_db.get_messages("INC-001")
    assert len(messages) == 5
    
    print(f"✅ Workflow complete: {event['status']}")
    print(f"✅ Total messages: {len(messages)}")
    print("\n" + "="*60)
    print("Full Workflow Test: PASSED ✅")
    print("="*60)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
