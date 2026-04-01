# Qwen Code Skill 配置指南

让 Qwen Code 可以直接调用 iMessage 读取功能。

---

## 📁 文件结构

```
skills/
├── qwen-skill              # 主入口脚本
├── qwen-skills.json        # 技能配置
└── imessage/
    ├── imessage_skill.py   # iMessage 核心功能
    └── ...
```

---

## 🚀 安装步骤

### 步骤 1: 添加技能到 Qwen Code 配置

编辑 `~/.qwen/settings.json`，添加：

```json
{
  "skills": {
    "custom": [
      {
        "name": "imessage",
        "description": "读取 macOS iMessage 消息",
        "command": "python3",
        "args": ["/Users/benson/Documents/incident/skills/qwen-skill", "imessage"],
        "path": "/Users/benson/Documents/incident/skills"
      }
    ]
  }
}
```

### 步骤 2: 赋予执行权限

```bash
chmod +x /Users/benson/Documents/incident/skills/qwen-skill
```

### 步骤 3: 测试技能

```bash
# 测试命令行调用
./skills/qwen-skill imessage last "+18336801616"

# 或通过 Python
python3 skills/qwen-skill imessage search "+18336801616" 5
```

---

## 💡 在 Qwen Code 中使用

### 方式 1: 直接命令

在 Qwen Code 对话框中输入：

```
帮我查看 +18336801616 的最后一条 iMessage 消息
```

Qwen Code 将自动调用 iMessage 技能。

### 方式 2: 使用工具调用

如果配置了 MCP，Qwen Code 可以：

```
/tools imessage last +18336801616
```

### 方式 3: 自然语言

```
我想知道谁最后给我发了短信
```

Qwen Code 可以分析并调用相应技能。

---

## 📋 可用命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `last <contact>` | 获取最后一条消息 | `last +18336801616` |
| `search <contact> [limit]` | 搜索消息 | `search james 10` |
| `contacts` | 查看所有联系人 | `contacts` |
| `export <contact> [file]` | 导出消息 | `export +18336801616 msg.json` |

---

## 🔧 技能配置详解

### qwen-skills.json

```json
{
  "skills": [
    {
      "name": "imessage",
      "description": "读取 macOS iMessage 消息数据",
      "version": "1.0.0",
      "entry": "imessage_skill.py",
      "commands": [
        {
          "name": "last",
          "description": "获取指定联系人的最后一条消息",
          "parameters": [
            {
              "name": "contact",
              "type": "string",
              "required": true
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 🧪 测试

```bash
# 运行所有测试
./skills/imessage/test.sh

# 单项测试
./skills/qwen-skill imessage last "+18336801616"
./skills/qwen-skill imessage search "+18336801616" 5
./skills/qwen-skill imessage contacts
./skills/qwen-skill imessage export "+18336801616" /tmp/test.json
```

---

## ⚠️ 权限要求

需要授予终端 **完全磁盘访问权限**：

1. 系统设置 > 隐私与安全性 > 完全磁盘访问权限
2. 添加终端应用
3. 重启终端

---

## 📝 输出示例

### last 命令

```
╭─────────────────────────────────────────────
│ 📥 对方 | +18336801616
├─────────────────────────────────────────────
│ 📅 时间：2026-02-15 19:07:02
│ 💬 内容：Your T&T order 002082922 has been delivered.
╰─────────────────────────────────────────────
```

### search 命令

```
✅ 找到 5 条消息:

[1] 📥 2026-02-15 19:07:02: Your T&T order 002082922 has been delivered.
[2] 📥 2026-02-15 17:39:56: [无内容]
[3] 📥 2026-02-15 16:25:28: [无内容]
```

### contacts 命令

```
✅ 共找到 500 个联系人:

  • +18336801616
  • jamesjmzhang@icloud.com
  • +14165621363
  ...
```

---

## 🤖 让其他 AI 使用

### Claude Desktop

编辑 `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "imessage": {
      "command": "python3",
      "args": ["/Users/benson/Documents/incident/skills/imessage/imessage_skill.py"]
    }
  }
}
```

### LangChain

```python
from langchain.tools import tool
from skills.imessage.imessage_skill import get_last_message

@tool
def imessage_last(contact: str) -> str:
    """获取联系人的最后一条消息"""
    msg = get_last_message(contact)
    return f"{msg['date']}: {msg['text']}"
```

---

## 📚 相关文档

- [RFC.md](imessage/RFC.md) - 正式规范
- [INTEGRATION.md](imessage/INTEGRATION.md) - 集成指南
- [USAGE.md](imessage/USAGE.md) - 使用说明

---

*Qwen Code Skill - iMessage | 2026-04-01*
