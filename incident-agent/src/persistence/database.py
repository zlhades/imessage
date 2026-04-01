"""
Agent Database - SQLite persistence

Stores events, states, and knowledge.
"""

import sqlite3
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path


class AgentDatabase:
    """SQLite database for agent persistence"""
    
    def __init__(self, db_path: str = "data/agent.db"):
        self.db_path = db_path
        
        # Ensure directory exists
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        
        self._init_tables()
    
    def _init_tables(self):
        """Initialize database tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Events table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                severity TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                context JSON
            )
        """)
        
        # States table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS states (
                session_id TEXT PRIMARY KEY,
                state JSON NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id)
            )
        """)
        
        conn.commit()
        conn.close()
    
    def save_event(self, event_id: str, status: str, context: Dict[str, Any]):
        """Save or update an event"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Ensure context is a dict, not already JSON string
        if isinstance(context, str):
            context_json = context
        else:
            context_json = json.dumps(context)
        
        cursor.execute("""
            INSERT OR REPLACE INTO events (id, status, context, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (event_id, status, context_json))
        
        conn.commit()
        conn.close()
    
    def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Get an event by ID"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return {
                "id": row[0],
                "status": row[1],
                "created_at": row[2],
                "updated_at": row[3],
                "context": json.loads(row[4]) if row[4] else None
            }
        return None
    
    def get_pending_events(self) -> List[Dict[str, Any]]:
        """Get all pending events"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM events 
            WHERE status IN ('OPEN', 'INVESTIGATING', 'WAITING_CONFIRM')
            ORDER BY created_at DESC
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "id": row[0],
                "status": row[1],
                "created_at": row[2],
                "updated_at": row[3],
                "context": json.loads(row[4]) if row[4] else None
            }
            for row in rows
        ]
    
    def save_state(self, session_id: str, state: Dict[str, Any]):
        """Save agent state"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO states (session_id, state, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (session_id, json.dumps(state)))
        
        conn.commit()
        conn.close()
    
    def get_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get agent state"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT state FROM states WHERE session_id = ?", (session_id,))
        row = cursor.fetchone()
        
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    
    def add_message(self, event_id: str, role: str, content: str):
        """Add a message to an event"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO messages (event_id, role, content)
            VALUES (?, ?, ?)
        """, (event_id, role, content))
        
        conn.commit()
        conn.close()
    
    def get_messages(self, event_id: str) -> List[Dict[str, Any]]:
        """Get all messages for an event"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT role, content, created_at FROM messages
            WHERE event_id = ?
            ORDER BY created_at ASC
        """, (event_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {"role": row[0], "content": row[1], "created_at": row[2]}
            for row in rows
        ]
    
    def close_event(self, event_id: str):
        """Close an event"""
        self.save_event(event_id, "CLOSED", {})
    
    def cleanup_old_events(self, days: int = 30):
        """Clean up old events"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM events 
            WHERE status = 'CLOSED' 
            AND updated_at < datetime('now', ?)
        """, (f'-{days} days',))
        
        conn.commit()
        conn.close()
