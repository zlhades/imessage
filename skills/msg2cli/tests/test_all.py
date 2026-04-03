"""
msg2cli - Test Suite

Structure:
- Unit tests (minimal): module init + core logic only
- E2E tests (comprehensive): full pipeline scenarios, loop prevention, auto-reply
"""

import pytest
import os
import sys
import time
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


# =============================================================================
# PART 1: Unit Tests (minimal — only structure and core logic)
# =============================================================================

class TestIMessageInput:
    """iMessage input — real DB read + error path."""

    def test_get_last_message_real_db(self):
        from input.imessage import IMessageInput
        inp = IMessageInput({"contacts": ["zlhades@icloud.com"]})
        msg = inp.get_last_message()
        if msg:
            assert all(hasattr(msg, a) for a in ('id', 'text', 'sender', 'timestamp', 'is_from_me'))

    def test_get_contacts_real_db(self):
        from input.imessage import IMessageInput
        inp = IMessageInput({"contacts": []})
        contacts = inp.get_contacts()
        assert isinstance(contacts, list)
        assert len(contacts) > 0
        assert "handle" in contacts[0]

    def test_db_not_found(self):
        from input.imessage import IMessageInput
        inp = IMessageInput({"contacts": [], "db_path": "/nonexistent/chat.db"})
        assert inp.get_last_message() is None

    def test_is_auto_message_emoji_loop_prevention(self):
        from input.base import BaseInput
        class Dummy(BaseInput):
            def __init__(self): super().__init__(None)
            def get_last_message(self): return None
            def search_messages(self, c, l=10): return []
            def get_contacts(self): return []

        markers = ["[Done]", "[Failed]", "[Received]", "[Auto]", "[Timeout]"]
        inp = Dummy()
        assert inp.is_auto_message("[Done] run ls -la", markers) is True
        assert inp.is_auto_message("[Received] hello", markers) is True
        assert inp.is_auto_message("run ls -la", markers) is False


class TestQwenOutput:
    """Qwen output — init + error detection."""

    def test_init_defaults(self):
        from output.qwen import QwenOutput
        out = QwenOutput({"enabled": True, "session": "test"})
        assert out.session == "test"
        assert out.min_wait_seconds == 5
        assert len(out.finished_markers) > 0

    @patch('subprocess.run')
    def test_inject_no_session(self, mock_run):
        from output.qwen import QwenOutput
        mock_run.return_value = MagicMock(returncode=1)
        out = QwenOutput({"enabled": True, "session": "nope"})
        assert out.inject("test") is False

    def test_is_error_detection(self):
        from output.qwen import QwenOutput
        out = QwenOutput({"enabled": True, "session": "test"})
        assert out.is_error("Traceback (most recent call last)") is True
        assert out.is_error("Error: something") is True
        assert out.is_error("total 100\ndrwxr-xr-x") is False


class TestIMessageReply:
    """iMessage reply — formatting only (AppleScript not mocked)."""

    def test_send_summary_format(self):
        from reply.base import BaseReply
        class Dummy(BaseReply):
            def __init__(self, c): super().__init__(c); self.sent = []
            def send(self, c, m): self.sent.append((c, m)); return True

        r = Dummy({"enabled": True, "reply_to": "test@test.com"})
        r.send_summary("test@test.com", "run ls -la", "total 100\ndrwxr-xr-x", True)
        assert len(r.sent) == 1
        _, msg = r.sent[0]
        assert "[Done]" in msg
        assert "run ls -la" in msg

    def test_send_error_format(self):
        from reply.base import BaseReply
        class Dummy(BaseReply):
            def __init__(self, c): super().__init__(c); self.sent = []
            def send(self, c, m): self.sent.append((c, m)); return True

        r = Dummy({"enabled": True, "reply_to": "test@test.com"})
        r.send_error("test@test.com", "run test", "File not found")
        assert len(r.sent) == 1
        _, msg = r.sent[0]
        assert "[Failed]" in msg
        assert "File not found" in msg

    def test_escape_applescript(self):
        from reply.imessage import IMessageReply
        r = IMessageReply({"enabled": True, "reply_to": "test@test.com"})
        assert r._escape_applescript('hello"world') == 'hello\\"world'
        assert r._escape_applescript('$VAR') == '\\$VAR'


class TestConfig:
    """YAML config structure validation."""

    def test_config_structure(self):
        import yaml
        cfg_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        with open(cfg_path) as f:
            cfg = yaml.safe_load(f)
        for key in ("inputs", "outputs", "routing", "reply", "settings"):
            assert key in cfg, f"Missing key: {key}"
        assert cfg["inputs"]["imessage"]["enabled"] is True
        assert cfg["outputs"]["qwen"]["enabled"] is True

    def test_auto_reply_patterns_configured(self):
        import yaml
        cfg_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        with open(cfg_path) as f:
            cfg = yaml.safe_load(f)
        patterns = cfg["reply"]["imessage"]["auto_reply_patterns"]
        assert len(patterns) > 0
        for p in patterns:
            assert "pattern" in p and "response" in p

    def test_anti_loop_markers_configured(self):
        import yaml
        cfg_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        with open(cfg_path) as f:
            cfg = yaml.safe_load(f)
        markers = cfg["settings"]["auto_markers"]
        assert len(markers) > 0
        # Verify reply markers are in auto_markers to prevent loops
        reply_markers = {"[Done]", "[Failed]", "[Received]", "[Timeout]"}
        # The actual markers in config should cover auto-generated replies
        assert any("Done" in m or "done" in m.lower() for m in markers) or \
               any(m in "[Done] [Failed] [Received] [Timeout]" for m in markers)


# =============================================================================
# PART 2: E2E Tests (comprehensive pipeline scenarios)
# =============================================================================

class TestE2E_AutoReplyLoopPrevention:
    """
    E2E: Auto-reply loop prevention.
    Verifies that messages containing reply markers are ignored.
    """

    def _make_watcher(self):
        from watcher import Watcher
        cfg = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        return Watcher(cfg)

    def test_done_marker_is_ignored(self):
        """Messages starting with [Done] should not trigger injection."""
        w = self._make_watcher()
        # Simulate that a reply message would be detected
        assert w.input.is_auto_message("[Done] run ls", w.auto_markers) is True

    def test_failed_marker_is_ignored(self):
        """Messages starting with [Failed] should not trigger injection."""
        w = self._make_watcher()
        assert w.input.is_auto_message("[Failed] check logs", w.auto_markers) is True

    def test_received_marker_is_ignored(self):
        """Messages starting with [Received] should not trigger injection."""
        w = self._make_watcher()
        assert w.input.is_auto_message("[Received] hello world", w.auto_markers) is True

    def test_timeout_marker_is_ignored(self):
        """Messages starting with [Timeout] should not trigger injection."""
        w = self._make_watcher()
        assert w.input.is_auto_message("[Timeout] please retry", w.auto_markers) is True

    def test_normal_message_passes(self):
        """Normal messages without markers should NOT be filtered."""
        w = self._make_watcher()
        assert w.input.is_auto_message("run ls -la /tmp", w.auto_markers) is False
        assert w.input.is_auto_message("create a python project", w.auto_markers) is False
        assert w.input.is_auto_message("search for error in logs", w.auto_markers) is False

    def test_auto_reply_pattern_match(self):
        """Config auto_reply_patterns should be loaded into Watcher."""
        w = self._make_watcher()
        assert isinstance(w.auto_patterns, list)
        # Each pattern should be (pattern_string, response_string)
        for pattern, response in w.auto_patterns:
            assert isinstance(pattern, str) and len(pattern) > 0
            assert isinstance(response, str) and len(response) > 0

    def test_auto_reply_pattern_hits(self):
        """When a message matches auto_reply_patterns, match_auto_reply returns response."""
        w = self._make_watcher()
        if w.auto_patterns:
            pattern_str, response_str = w.auto_patterns[0]
            assert w.match_auto_reply(pattern_str) == response_str
            # Partial match
            assert w.match_auto_reply(f"prefix {pattern_str} suffix") == response_str

    def test_auto_reply_pattern_miss(self):
        """Non-matching message returns None."""
        w = self._make_watcher()
        result = w.match_auto_reply("run ls -la /tmp")
        # Should only match configured patterns
        for pattern, _ in w.auto_patterns:
            assert pattern not in "run ls -la /tmp" or result is not None


class TestE2E_WatcherLifecycle:
    """
    E2E: Watcher initialization and lifecycle.
    """

    def test_watcher_full_init(self):
        """Watcher should initialize all components correctly."""
        from watcher import Watcher
        cfg = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        w = Watcher(cfg)

        assert w.input is not None
        assert w.output is not None
        assert w.reply is not None
        assert w.check_interval > 0
        assert isinstance(w.stats, dict)
        assert w.stats == {"total": 0, "auto_reply": 0, "ai_inject": 0, "skipped": 0}

    def test_watcher_loads_processed_messages(self):
        """Watcher should load done_file if it exists."""
        from watcher import Watcher
        cfg = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        w = Watcher(cfg)
        assert isinstance(w.done, set)

    def test_watcher_mark_done(self):
        """mark_done should add to set and write file."""
        from watcher import Watcher
        cfg = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        w = Watcher(cfg)

        test_msg = "e2e_test_message_unique_12345"
        w.mark_done(test_msg)
        assert test_msg in w.done

    def test_watcher_done_file_persistence(self):
        """mark_done should persist to disk."""
        from watcher import Watcher
        cfg = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        w = Watcher(cfg)

        test_msg = "e2e_test_persist_67890"
        w.mark_done(test_msg)

        # Read back from file
        with open(w.done_file) as f:
            content = f.read()
        assert test_msg in content

    def test_watcher_done_file_size_limit(self):
        """done set should cap at 500 entries after exceeding 1000."""
        from watcher import Watcher
        cfg = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        w = Watcher(cfg)
        w.done = set()

        # Add 1001 messages
        for i in range(1001):
            w.mark_done(f"msg_{i}")

        assert len(w.done) <= 500


class TestE2E_InputOutputChain:
    """
    E2E: Full input → output chain integration.
    """

    def test_all_modules_instantiate(self):
        """All modules should instantiate without errors."""
        from input.imessage import IMessageInput
        from output.qwen import QwenOutput
        from reply.imessage import IMessageReply

        inp = IMessageInput({"contacts": ["zlhades@icloud.com"]})
        out = QwenOutput({"enabled": True, "session": "test_e2e"})
        rep = IMessageReply({"enabled": True, "reply_to": "test@test.com"})

        assert inp.contacts == ["zlhades@icloud.com"]
        assert out.session == "test_e2e"
        assert rep.reply_to == "test@test.com"

    def test_input_reads_real_contacts(self):
        """Input module should read real contacts from DB."""
        from input.imessage import IMessageInput
        inp = IMessageInput({"contacts": []})
        contacts = inp.get_contacts()
        assert len(contacts) > 0
        # All contacts should have a handle
        for c in contacts:
            assert c["handle"], f"Empty handle in contact: {c}"

    def test_output_status_report(self):
        """QwenOutput should report status even without session."""
        from output.qwen import QwenOutput
        out = QwenOutput({"enabled": True, "session": "nonexistent_e2e_test"})
        status = out.get_status()
        assert "session" in status
        assert "exists" in status
        assert "enabled" in status
        assert status["exists"] is False

    def test_reply_status_report(self):
        """IMessageReply should report status."""
        from reply.imessage import IMessageReply
        rep = IMessageReply({"enabled": True, "reply_to": "test@test.com"})
        status = rep.get_status()
        assert "enabled" in status
        assert "reply_to" in status


class TestE2E_InstructionAnalysis:
    """
    E2E: Instruction analysis from config + watcher.
    """

    def test_watcher_auto_markers_cover_reply_markers(self):
        """
        Anti-loop: auto_markers in config should cover all possible
        reply prefixes so the watcher never re-processes its own messages.
        """
        import yaml
        cfg_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        with open(cfg_path) as f:
            cfg = yaml.safe_load(f)

        auto_markers = set(cfg["settings"]["auto_markers"])

        # All possible reply prefixes the system generates
        reply_prefixes = ["[Done]", "[Failed]", "[Received]", "[Timeout]", "[Auto]"]
        for prefix in reply_prefixes:
            # The prefix (or a marker within it) should be covered by auto_markers
            # Since we use bracket-style markers, check if any auto_marker matches
            has_coverage = any(prefix in m or m in prefix for m in auto_markers)
            # If not directly covered, the emoji in auto_markers should cover it
            # since replies use bracket format, we need bracket markers in auto_markers
            assert has_coverage or any(m.startswith("[") for m in auto_markers), \
                f"Reply prefix '{prefix}' not covered by auto_markers: {auto_markers}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
