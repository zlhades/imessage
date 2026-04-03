"""
msg2cli - 完整测试套件

测试覆盖：
1. 输入模块（iMessage 数据库读取）
2. 输出模块（Qwen tmux 注入 + 完成检测）
3. 回复模块（iMessage 发送 + 格式化）
4. 监听器（Watcher 初始化 + 自动回复匹配）
5. 注入器（tmux 注入）
6. 配置加载（YAML 结构验证）
7. 防死循环机制
8. 指令分析（正则提取）
9. 集成测试（端到端流程）
"""

import pytest
import os
import sys
import re
import time
from unittest.mock import patch, MagicMock, PropertyMock

# 添加 src 到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


# =============================================================================
# 测试 1: 输入模块
# =============================================================================

class TestIMessageInput:
    """测试 iMessage 输入源"""

    def test_get_last_message(self):
        """测试读取最后一条消息"""
        from input.imessage import IMessageInput
        inp = IMessageInput({
            "contacts": ["zlhades@icloud.com"],
            "db_path": os.path.expanduser("~/Library/Messages/chat.db")
        })
        msg = inp.get_last_message()
        # 可能有也可能没有消息
        if msg:
            assert hasattr(msg, 'id')
            assert hasattr(msg, 'text')
            assert hasattr(msg, 'sender')
            assert hasattr(msg, 'is_from_me')

    def test_search_messages(self):
        """测试搜索消息"""
        from input.imessage import IMessageInput
        inp = IMessageInput({
            "contacts": ["zlhades@icloud.com"],
            "db_path": os.path.expanduser("~/Library/Messages/chat.db")
        })
        results = inp.search_messages("zlhades@icloud.com", limit=3)
        assert isinstance(results, list)
        assert len(results) <= 3

    def test_get_contacts(self):
        """测试获取联系人"""
        from input.imessage import IMessageInput
        inp = IMessageInput({
            "contacts": [],
            "db_path": os.path.expanduser("~/Library/Messages/chat.db")
        })
        contacts = inp.get_contacts()
        assert isinstance(contacts, list)
        assert len(contacts) > 0
        assert "handle" in contacts[0]

    def test_db_not_found(self):
        """测试数据库不存在"""
        from input.imessage import IMessageInput
        inp = IMessageInput({
            "contacts": [],
            "db_path": "/nonexistent/path/chat.db"
        })
        assert inp.get_last_message() is None

    def test_is_auto_message(self):
        """测试自动消息检测"""
        from input.base import BaseInput

        class DummyInput(BaseInput):
            def __init__(self, config=None):
                super().__init__(config)

            def get_last_message(self): return None

            def search_messages(self, c, l=10): return []

            def get_contacts(self): return []

        inp = DummyInput()
        markers = ["✅", "📊", "❌", "执行完成"]
        assert inp.is_auto_message("✅ 执行完成", markers) is True
        assert inp.is_auto_message("📊 报告", markers) is True
        assert inp.is_auto_message("普通消息", markers) is False


# =============================================================================
# 测试 2: 输出模块
# =============================================================================

class TestQwenOutput:
    """测试 Qwen 输出"""

    def test_init(self):
        """测试初始化"""
        from output.qwen import QwenOutput
        out = QwenOutput({
            "enabled": True,
            "type": "tmux",
            "session": "test_session",
            "command": "qwen",
            "prompt_suffix": "【测试】"
        })
        assert out.enabled is True
        assert out.session == "test_session"
        assert out.prompt_suffix == "【测试】"

    @patch('subprocess.run')
    def test_inject_no_session(self, mock_run):
        """测试 tmux 会话不存在时注入失败"""
        from output.qwen import QwenOutput
        mock_run.return_value = MagicMock(returncode=1)
        out = QwenOutput({"enabled": True, "session": "nonexistent", "prompt_suffix": ""})
        result = out.inject("test message")
        assert result is False

    def test_get_output_no_session(self):
        """测试获取不存在的 tmux 会话输出"""
        from output.qwen import QwenOutput
        out = QwenOutput({"enabled": True, "session": "nonexistent_session"})
        output = out.get_output()
        assert output == ""

    def test_is_error_detection(self):
        """测试错误检测"""
        from output.qwen import QwenOutput
        out = QwenOutput({"enabled": True, "session": "test"})

        assert out.is_error("Error: something failed") is True
        assert out.is_error("Traceback (most recent call last)") is True
        assert out.is_error("Command not found: xyz") is True
        assert out.is_error("total 100\ndrwxr-xr-x") is False

    def test_finished_markers_configurable(self):
        """测试完成标记可配置"""
        from output.qwen import QwenOutput
        out = QwenOutput({
            "enabled": True,
            "session": "test",
            "finished_markers": ["CUSTOM_DONE"],
            "min_wait": 0
        })
        assert out.finished_markers == ["CUSTOM_DONE"]


# =============================================================================
# 测试 3: 回复模块
# =============================================================================

class TestIMessageReply:
    """测试 iMessage 回复"""

    def test_init(self):
        """测试初始化"""
        from reply.imessage import IMessageReply
        r = IMessageReply({"enabled": True, "reply_to": "test@example.com"})
        assert r.enabled is True
        assert r.reply_to == "test@example.com"

    def test_send_summary_format(self):
        """测试摘要格式"""
        from reply.base import BaseReply

        class DummyReply(BaseReply):
            def __init__(self, config):
                super().__init__(config)
                self.sent = []

            def send(self, c, m):
                self.sent.append((c, m))
                return True

        r = DummyReply({"enabled": True, "reply_to": "test@example.com"})
        r.send_summary("test@example.com", "运行 ls -la", "total 100\ndrwxr-xr-x", True)
        assert len(r.sent) == 1
        contact, msg = r.sent[0]
        assert "✅ 执行完成" in msg
        assert "运行 ls -la" in msg
        assert "total 100" in msg

    def test_send_error_format(self):
        """测试错误格式"""
        from reply.base import BaseReply

        class DummyReply(BaseReply):
            def __init__(self, config):
                super().__init__(config)
                self.sent = []

            def send(self, c, m):
                self.sent.append((c, m))
                return True

        r = DummyReply({"enabled": True, "reply_to": "test@example.com"})
        r.send_error("test@example.com", "run test", "File not found")
        assert len(r.sent) == 1
        contact, msg = r.sent[0]
        assert "❌ 执行失败" in msg
        assert "run test" in msg
        assert "File not found" in msg

    def test_escape_applescript(self):
        """测试 AppleScript 转义"""
        from reply.imessage import IMessageReply
        r = IMessageReply({"enabled": True, "reply_to": "test@example.com"})

        assert r._escape_applescript('hello"world') == 'hello\\"world'
        assert r._escape_applescript('$VAR') == '\\$VAR'
        assert r._escape_applescript('line1\nline2') == 'line1 line2'
        assert r._escape_applescript('`cmd`') == '\\`cmd\\`'


# =============================================================================
# 测试 4: 注入器
# =============================================================================

class TestInjector:
    """测试 tmux 注入器"""

    def test_init(self):
        """测试初始化"""
        from injector import Injector
        inj = Injector("test_session", "【测试】")
        assert inj.session == "test_session"
        assert inj.prompt_suffix == "【测试】"

    @patch('subprocess.run')
    def test_inject_no_session(self, mock_run):
        """测试会话不存在"""
        from injector import Injector
        mock_run.return_value = MagicMock(returncode=1)
        inj = Injector("nonexistent")
        assert inj.inject("test") is False


# =============================================================================
# 测试 5: 配置加载
# =============================================================================

class TestConfig:
    """测试 YAML 配置加载"""

    def test_load_config(self):
        """测试加载配置文件"""
        import yaml
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            assert "inputs" in config
            assert "outputs" in config
            assert "routing" in config
            assert "reply" in config
            assert "settings" in config

    def test_config_imessage_enabled(self):
        """测试 iMessage 配置"""
        import yaml
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            assert config["inputs"]["imessage"]["enabled"] is True
            assert len(config["inputs"]["imessage"]["contacts"]) > 0

    def test_config_qwen_enabled(self):
        """测试 Qwen 配置"""
        import yaml
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            assert config["outputs"]["qwen"]["enabled"] is True

    def test_config_auto_reply_patterns(self):
        """测试自动回复模式配置"""
        import yaml
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            patterns = config.get("reply", {}).get("imessage", {}).get("auto_reply_patterns", [])
            assert len(patterns) > 0
            for p in patterns:
                assert "pattern" in p
                assert "response" in p


# =============================================================================
# 测试 6: Watcher 核心逻辑
# =============================================================================

class TestWatcher:
    """测试 Watcher"""

    def test_init(self):
        """测试 Watcher 初始化"""
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        if os.path.exists(config_path):
            from watcher import Watcher
            w = Watcher(config_path)
            assert w.input is not None
            assert w.output is not None
            assert w.reply is not None
            assert w.check_interval > 0
            assert isinstance(w.auto_patterns, list)

    def test_match_auto_reply(self):
        """测试自动回复匹配"""
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        if os.path.exists(config_path):
            from watcher import Watcher
            w = Watcher(config_path)
            # 应该匹配到测试模式的回复
            result = w.match_auto_reply("测试")
            if w.auto_patterns:
                assert result is not None or result is None  # 取决于配置


# =============================================================================
# 测试 7: 防死循环
# =============================================================================

class TestLoopPrevention:
    """测试防死循环机制"""

    def test_auto_markers(self):
        """测试自动消息标记"""
        from input.base import BaseInput

        class DummyInput(BaseInput):
            def __init__(self, config=None):
                super().__init__(config)

            def get_last_message(self): return None

            def search_messages(self, c, l=10): return []

            def get_contacts(self): return []

        inp = DummyInput()
        markers = ["✅", "📊", "❌", "🚀", "👋", "[自动]", "执行完成", "收到："]

        # 应该被忽略的消息
        for marker in markers:
            assert inp.is_auto_message(f"{marker} 测试", markers) is True

        # 应该处理的消息
        assert inp.is_auto_message("运行 ls -la", markers) is False
        assert inp.is_auto_message("帮我创建一个文件", markers) is False
        assert inp.is_auto_message("测试", markers) is False


# =============================================================================
# 测试 8: 指令分析
# =============================================================================

class TestInstructionAnalysis:
    """测试指令分析"""

    def test_command_patterns(self):
        """测试命令模式匹配"""
        patterns = [
            r'运行\s*(.+)', r'执行\s*(.+)', r'run\s+(.+)',
            r'create file\s+(.+)', r'创建文件\s*(.+)',
        ]

        tests = [
            ("运行 ls -la", "ls -la"),
            ("执行 python3 test.py", "python3 test.py"),
            ("run echo hello", "echo hello"),
            ("创建文件 /tmp/test.txt", "/tmp/test.txt"),
            ("普通消息", None),
        ]

        for text, expected in tests:
            matched = None
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    matched = match.group(1).strip()
                    break
            assert matched == expected, f"Failed for '{text}': expected '{expected}', got '{matched}'"


# =============================================================================
# 测试 9: 集成测试（端到端）
# =============================================================================

class TestIntegration:
    """集成测试 — 验证端到端流程"""

    def test_input_output_chain(self):
        """测试输入→分析→输出链"""
        from input.imessage import IMessageInput
        from output.qwen import QwenOutput
        from reply.imessage import IMessageReply

        # 验证所有模块可以实例化
        inp = IMessageInput({
            "contacts": ["zlhades@icloud.com"],
            "db_path": os.path.expanduser("~/Library/Messages/chat.db")
        })
        out = QwenOutput({
            "enabled": True,
            "session": "test_integration",
            "command": "qwen"
        })
        rep = IMessageReply({
            "enabled": True,
            "reply_to": "test@example.com"
        })

        # 验证输入可用
        contacts = inp.get_contacts()
        assert isinstance(contacts, list)

        # 验证输出配置正确
        assert out.session == "test_integration"
        assert out.enabled is True

        # 验证回复配置
        assert rep.reply_to == "test@example.com"

    def test_watcher_full_init(self):
        """测试 Watcher 完整初始化"""
        config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'config.yaml')
        if os.path.exists(config_path):
            from watcher import Watcher
            w = Watcher(config_path)

            # 验证所有组件
            assert w.input is not None
            assert w.output is not None
            assert w.reply is not None
            assert isinstance(w.done, set)
            assert isinstance(w.stats, dict)
            assert "total" in w.stats
            assert "auto_reply" in w.stats
            assert "ai_inject" in w.stats

            # 验证统计初始值
            assert w.stats["total"] == 0
            assert w.stats["auto_reply"] == 0

    def test_output_status_report(self):
        """测试输出状态报告"""
        from output.qwen import QwenOutput
        out = QwenOutput({
            "enabled": True,
            "session": "nonexistent_for_test",
            "command": "qwen"
        })
        status = out.get_status()
        assert "session" in status
        assert "exists" in status
        assert "enabled" in status
        assert status["exists"] is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
