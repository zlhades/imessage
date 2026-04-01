#!/usr/bin/env python3
"""
Simple Test Runner - Without pytest

Run with: python3 tests/run_tests.py
"""

import sys
import os
import json
from pathlib import Path

# Add src to path (but not src/__init__.py to avoid langgraph import)
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "persistence"))

from database import AgentDatabase


def test_database_init():
    """Test database initialization"""
    print("\n💾 Testing Database Initialization...")
    db_path = "data/test_run.db"
    db = AgentDatabase(db_path)
    assert db is not None
    print("✅ Database initialized")
    
    # Cleanup
    if os.path.exists(db_path):
        os.remove(db_path)
    
    return True


def test_full_workflow():
    """Test complete incident workflow"""
    print("\n" + "="*60)
    print("Testing Full Incident Workflow")
    print("="*60)
    
    db_path = "data/test_workflow.db"
    db = AgentDatabase(db_path)
    
    try:
        # Step 1: Create event
        print("\n1️⃣  Create Event")
        db.save_event("INC-001", "OPEN", {"incident": "API 500 error"})
        event = db.get_event("INC-001")
        assert event is not None
        assert event["status"] == "OPEN"
        print("✅ Event created")
        
        # Step 2: Add analysis
        print("2️⃣  Add Analysis")
        db.add_message("INC-001", "system", "Analysis: WAITING_INFO")
        print("✅ Analysis added")
        
        # Step 3: Add questions
        print("3️⃣  Generate Questions")
        db.add_message("INC-001", "assistant", "请问具体是哪个服务？")
        print("✅ Questions generated")
        
        # Step 4: Add response
        print("4️⃣  Teammate Response")
        db.add_message("INC-001", "user", "payment-service")
        print("✅ Teammate responded")
        
        # Step 5: Update status
        print("5️⃣  Update Status")
        db.save_event("INC-001", "INVESTIGATING", {"step": "investigation"})
        print("✅ Status updated")
        
        # Step 6: Investigation
        print("6️⃣  Investigation")
        db.add_message("INC-001", "system", "调查结果：连接池满")
        print("✅ Investigation complete")
        
        # Step 7: Draft response
        print("7️⃣  Draft Response")
        db.save_event("INC-001", "WAITING_CONFIRM", {"draft": "建议重启服务"})
        print("✅ Draft created")
        
        # Step 8: Confirm and send
        print("8️⃣  Confirm and Send")
        db.add_message("INC-001", "assistant", "建议重启服务")
        db.save_event("INC-001", "RESPONDED", {})
        print("✅ Response sent")
        
        # Step 9: Close
        print("9️⃣  Close Incident")
        db.add_message("INC-001", "user", "已修复 [CLOSED]")
        db.close_event("INC-001")
        print("✅ Incident closed")
        
        # Verify
        print("\n📊 Verify Final State")
        event = db.get_event("INC-001")
        assert event is not None
        assert event["status"] == "CLOSED"
        
        messages = db.get_messages("INC-001")
        assert len(messages) == 5
        
        print(f"✅ Workflow complete: {event['status']}")
        print(f"✅ Total messages: {len(messages)}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Cleanup
        if os.path.exists(db_path):
            os.remove(db_path)
    
    print("\n" + "="*60)
    print("All Tests: PASSED ✅")
    print("="*60)
    
    return True


if __name__ == "__main__":
    print("\n🧪 Running Incident Agent Tests...\n")
    
    tests = [
        ("Database Init", test_database_init),
        ("Full Workflow", test_full_workflow),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ {name} FAILED: {e}")
            failed += 1
    
    print(f"\n📊 Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)
