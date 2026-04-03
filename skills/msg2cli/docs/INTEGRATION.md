# 🤖 其他 AI 集成指南

让其他 AI 系统使用 iMessage Skill 的快速指南。

---

## 方式 1: MCP 协议集成（推荐）

### 步骤 1: 复制技能文件

```bash
cp -r /Users/benson/Documents/incident/skills/imessage /your/project/path/
```

### 步骤 2: 配置 MCP 服务器

在你的 AI 系统配置中添加：

```json
{
  "mcpServers": {
    "imessage": {
      "command": "python3",
      "args": ["/absolute/path/to/imessage_skill.py"]
    }
  }
}
```

### 步骤 3: 调用工具

AI 系统可以通过 MCP 协议调用以下工具：

- `imessage_last` - 获取最后一条消息
- `imessage_search` - 搜索消息
- `imessage_contacts` - 查看联系人
- `imessage_export` - 导出消息

---

## 方式 2: 命令行调用

### 在任何 AI 系统中执行

```python
import subprocess
import json

def get_last_message(contact: str) -> dict:
    """获取联系人的最后一条消息"""
    result = subprocess.run(
        ["python3", "imessage_skill.py", "last", contact],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

def search_messages(contact: str, limit: int = 10) -> list:
    """搜索联系人消息"""
    result = subprocess.run(
        ["python3", "imessage_skill.py", "search", contact, str(limit)],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

# 使用示例
msg = get_last_message("+18336801616")
print(f"最新消息：{msg['text']}")
```

---

## 方式 3: HTTP API 封装

### 创建 HTTP 服务

```python
# server.py
from flask import Flask, request, jsonify
from imessage_skill import (
    get_last_message,
    search_contact_messages,
    get_all_contacts,
    export_messages
)

app = Flask(__name__)

@app.route('/api/imessage/last', methods=['POST'])
def api_last():
    data = request.json
    contact = data.get('contact')
    result = get_last_message(contact)
    return jsonify(result)

@app.route('/api/imessage/search', methods=['POST'])
def api_search():
    data = request.json
    contact = data.get('contact')
    limit = data.get('limit', 20)
    result = search_contact_messages(contact, limit)
    return jsonify(result)

@app.route('/api/imessage/contacts', methods=['GET'])
def api_contacts():
    result = get_all_contacts()
    return jsonify(result)

if __name__ == '__main__':
    app.run(port=5000)
```

### AI 系统调用

```python
import requests

# 获取最后一条消息
response = requests.post('http://localhost:5000/api/imessage/last', json={
    "contact": "+18336801616"
})
message = response.json()

# 搜索消息
response = requests.post('http://localhost:5000/api/imessage/search', json={
    "contact": "+18336801616",
    "limit": 10
})
messages = response.json()
```

---

## 方式 4: Python 模块导入

### 直接作为模块使用

```python
# 在你的 AI 项目中
import sys
sys.path.append('/path/to/imessage_skill')

from imessage_skill import (
    get_last_message,
    search_contact_messages,
    get_all_contacts,
    export_messages
)

# 直接使用
msg = get_last_message("+18336801616")
print(msg)

# 搜索消息
messages = search_contact_messages("+18336801616", limit=5)
for m in messages:
    print(f"{m['date']}: {m['text']}")
```

---

## 方式 5: LangChain 工具

### 创建 LangChain Tool

```python
from langchain.tools import tool
from imessage_skill import get_last_message, search_contact_messages

@tool
def imessage_last(contact: str) -> str:
    """获取指定联系人的最后一条消息"""
    result = get_last_message(contact)
    return f"时间：{result['date']}, 内容：{result['text']}"

@tool
def imessage_search(contact: str, limit: int = 5) -> str:
    """搜索指定联系人的消息"""
    results = search_contact_messages(contact, limit)
    return "\n".join([f"{r['date']}: {r['text']}" for r in results])

# 添加到 LangChain Agent
tools = [imessage_last, imessage_search]
```

---

## 方式 6: LlamaIndex 工具

### 创建 LlamaIndex Tool

```python
from llama_index.core.tools import FunctionTool
from imessage_skill import get_last_message, search_contact_messages

def imessage_last_fn(contact: str) -> dict:
    """获取指定联系人的最后一条消息"""
    return get_last_message(contact)

def imessage_search_fn(contact: str, limit: int = 5) -> list:
    """搜索指定联系人的消息"""
    return search_contact_messages(contact, limit)

# 创建工具
imessage_last_tool = FunctionTool.from_defaults(
    fn=imessage_last_fn,
    name="imessage_last",
    description="Get the last message from a contact"
)

imessage_search_tool = FunctionTool.from_defaults(
    fn=imessage_search_fn,
    name="imessage_search",
    description="Search messages from a contact"
)

# 添加到 Agent
tools = [imessage_last_tool, imessage_search_tool]
```

---

## 完整示例：Claude Desktop 集成

### 1. 配置 Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### 2. 重启 Claude Desktop

### 3. 在对话中使用

```
用户：帮我查看 +18336801616 的最后一条消息

Claude: [调用 imessage_last 工具]
       找到来自 +18336801616 的最后一条消息：
       时间：2026-02-15 19:07:02
       内容：Your T&T order 002082922 has been delivered.
```

---

## 完整示例：自定义 AI 助手

```python
# ai_assistant.py
import json
import subprocess

class IMessageAssistant:
    def __init__(self):
        self.script_path = "/path/to/imessage_skill.py"
    
    def _run_command(self, *args) -> dict:
        result = subprocess.run(
            ["python3", self.script_path] + list(args),
            capture_output=True,
            text=True
        )
        return json.loads(result.stdout)
    
    def answer_question(self, question: str) -> str:
        """回答关于 iMessage 的问题"""
        
        if "最后一条消息" in question or "最新消息" in question:
            # 提取联系人
            contact = self._extract_contact(question)
            if contact:
                msg = self._run_command("last", contact)
                return f"{contact} 的最后一条消息 ({msg['date']}): {msg['text']}"
        
        elif "所有消息" in question or "历史记录" in question:
            contact = self._extract_contact(question)
            if contact:
                msgs = self._run_command("search", contact, "10")
                return "\n".join([f"{m['date']}: {m['text']}" for m in msgs])
        
        elif "联系人" in question or "通讯录" in question:
            contacts = self._run_command("contacts")
            return f"共有 {len(contacts)} 个联系人"
        
        return "抱歉，我不理解您的问题。"
    
    def _extract_contact(self, question: str) -> str:
        # 简单的联系人提取逻辑
        # 实际应用中可以使用 NLP
        import re
        phone = re.search(r'\+?\d{10,15}', question)
        if phone:
            return phone.group()
        return None

# 使用
assistant = IMessageAssistant()
print(assistant.answer_question("查看 +18336801616 的最后一条消息"))
```

---

## 权限要求

无论使用哪种方式，都需要：

1. **macOS 系统**
2. **完全磁盘访问权限**
   - 系统设置 > 隐私与安全性 > 完全磁盘访问权限
   - 添加运行脚本的终端/应用

---

## API 参考

| 方法 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `last` | contact | Message | 最后一条消息 |
| `search` | contact, limit | Message[] | 搜索消息 |
| `contacts` | - | Contact[] | 所有联系人 |
| `export` | contact, output | {file: string} | 导出消息 |

---

## 支持的平台

- ✅ MCP 兼容的 AI (Qwen Code, Claude Desktop 等)
- ✅ LangChain
- ✅ LlamaIndex
- ✅ 自定义 Python 应用
- ✅ HTTP API 服务
- ✅ 命令行工具

---

**需要帮助？** 查看 [RFC.md](RFC.md) 获取完整规范文档。
