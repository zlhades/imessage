# iMessage Skill for Qwen CLI

## 🎯 在 Qwen CLI 中使用

### 方法 1: 使用 MCP 工具（推荐）

如果你已经配置了 MCP（`~/.qwen/settings.json` 中有 `imessage` 服务器）：

**在 Qwen Code 对话中直接说：**

```
查看 zlhades@icloud.com 的最后一条消息
```

Qwen 会自动调用 MCP 工具读取消息。

---

### 方法 2: 使用 Shell 命令工具

在 Qwen Code 对话中：

```
请执行这个命令并告诉我结果：
python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill_v2.py last "zlhades@icloud.com"
```

---

### 方法 3: 创建 Qwen Skill 配置文件

创建 `~/.qwen/skills/imessage.json`：

```json
{
  "name": "imessage",
  "description": "读取 iMessage 消息",
  "tools": [
    {
      "name": "read_last",
      "description": "读取联系人的最后一条消息",
      "command": "python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill_v2.py last {{contact}}"
    },
    {
      "name": "read_search",
      "description": "搜索联系人的消息",
      "command": "python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill_v2.py search {{contact}} {{limit}}"
    }
  ]
}
```

然后在 Qwen Code 中说：

```
/skill imessage read_last zlhades@icloud.com
```

---

## 📋 完整使用示例

### 在 Qwen Code 中

**用户**: 查看 zlhades@icloud.com 的最后一条消息

**Qwen** (自动调用 MCP 工具):
```json
{
  "text": "我是想做这样的事情，第一阶段我想做的就是：...",
  "date": "2026-04-01 07:50:42",
  "is_from_me": false
}
```

**Qwen**: 
```
找到来自 zlhades@icloud.com 的最后一条消息：
📅 时间：2026-04-01 07:50:42
💬 内容：我是想做这样的事情...
```

---

## 🔧 检查 MCP 配置

运行以下命令检查 MCP 是否配置好：

```bash
cat ~/.qwen/settings.json | grep -A 5 '"imessage"'
```

应该看到：

```json
"mcp": {
  "servers": {
    "imessage": {
      "command": "python3",
      "args": ["/Users/benson/Documents/incident/skills/imessage/imessage_skill.py"]
    }
  }
}
```

---

## ⚡ 快速测试

在 Qwen Code 中输入：

```
/tools
```

看看有没有 `imessage_last`、`imessage_search` 等工具。

如果有，直接说：
```
查看 zlhades@icloud.com 的最后一条消息
```

如果没有，需要重启 Qwen Code 或重新配置 MCP。

---

## 🎯 推荐做法

**在 Qwen Code 中使用（最简单）：**

1. 确保 MCP 配置正确
2. 重启 Qwen Code
3. 在对话中直接说：`查看 <联系人> 的最后一条消息`
4. Qwen 自动调用工具读取

**在终端中使用：**

```bash
# 直接读取
python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill_v2.py last "zlhades@icloud.com"

# 或创建别名
alias imsg='python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill_v2.py last'
imsg "zlhades@icloud.com"
```

---

你想用哪种方式？
