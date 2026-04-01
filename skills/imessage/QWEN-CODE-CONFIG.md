# Qwen Code iMessage Skill 配置

## 🎯 让 Qwen 自己知道如何读取 iMessage

把这个配置添加到 `~/.qwen/settings.json` 的 `skills` 部分：

```json
{
  "skills": {
    "imessage": {
      "enabled": true,
      "name": "iMessage Reader",
      "description": "读取 macOS iMessage 消息",
      "prompt": "你是一个 iMessage 读取助手。你可以执行以下命令读取用户的 iMessage 消息：\n\n1. 获取最后一条消息：`python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py last <联系人>`\n2. 搜索消息：`python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py search <联系人> <数量>`\n3. 查看联系人：`python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py contacts`\n4. 导出消息：`python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py export <联系人> <文件>`\n\n联系人可以是电话号码（如 +18336801616）、邮箱或姓名。",
      "auto_execute": {
        "patterns": [
          "查看.*消息",
          "最后一条.*消息",
          "最近.*消息",
          "iMessage",
          "imessage",
          "短信",
          "联系人.*消息"
        ]
      }
    }
  }
}
```

---

## 📝 完整配置示例

编辑 `~/.qwen/settings.json`：

```json
{
  "$version": 3,
  "model": {
    "name": "coder-model"
  },
  "skills": {
    "imessage": {
      "enabled": true,
      "name": "iMessage Reader",
      "description": "读取 macOS iMessage 消息",
      "prompt": "你是一个 iMessage 读取助手，运行在 macOS 系统上。你可以直接执行 shell 命令来读取用户的 iMessage 消息数据。\n\n可用命令：\n- 获取最后一条消息：`python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py last <联系人>`\n- 搜索消息：`python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py search <联系人> [数量]`\n- 查看联系人：`python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py contacts`\n- 导出消息：`python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py export <联系人> [文件]`\n\n联系人可以是：\n- 电话号码：+18336801616\n- 邮箱：jamesjmzhang@icloud.com\n- 姓名：james\n\n注意：\n- 使用中文回复\n- 执行命令前告知用户\n- 解读 JSON 结果为友好的格式",
      "auto_execute": {
        "patterns": [
          "查看.*消息",
          "最后一条.*消息",
          "最近.*消息",
          "iMessage",
          "imessage",
          "短信",
          "联系人",
          "谁给我.*发消息",
          "有什么消息"
        ],
        "enabled": true
      }
    }
  },
  "mcp": {
    "servers": {
      "imessage": {
        "command": "python3",
        "args": ["/Users/benson/Documents/incident/skills/imessage/imessage_skill.py"]
      }
    }
  }
}
```

---

## 🚀 使用方法

配置完成后，在 Qwen Code 中直接说：

### 示例 1: 查看最后一条消息

```
用户：查看 +18336801616 的最后一条消息

Qwen: [自动识别并执行命令]
      python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py last "+18336801616"
      
      来自 +18336801616 的最后一条消息：
      📅 时间：2026-02-15 19:07:02
      👤 发送者：对方
      💬 内容：Your T&T order 002082922 has been delivered.
```

### 示例 2: 查看最近消息

```
用户：+18336801616 最近发了什么？

Qwen: [自动执行搜索]
      python3 /Users/benson/Documents/incident/skills/imessage/imessage_skill.py search "+18336801616" 5
      
      找到来自 +18336801616 的最近 5 条消息：
      1. 📥 2026-02-15 19:07:02：您的 T&T 订单 002082922 已送达。
      2. 📥 2026-02-15 17:39:56：[无内容]
      ...
```

### 示例 3: 自然语言

```
用户：谁最后给我发短信了？

Qwen: [理解意图，执行命令]
      我来帮您查看最近的短信...
      
      [执行命令获取联系人列表，然后获取最新消息]
      
      最后给您发消息的是 +18336801616，内容是...
```

---

## 🎯 核心：让 Qwen"理解"而不是"调用"

关键是配置中的 **prompt** 部分，它告诉 Qwen：

1. **你是谁**：iMessage 读取助手
2. **你能做什么**：执行命令读取消息
3. **怎么做**：使用特定的命令格式
4. **何时做**：当用户提到相关关键词时

这样 Qwen 就会**主动理解**用户的意图，而不是被动等待指令。

---

## ⚠️ 注意事项

1. **权限**：需要授予终端完全磁盘访问权限
2. **路径**：确保配置中的路径正确
3. **重启**：配置后重启 Qwen Code 生效

---

*Qwen Code iMessage Skill 配置 | 2026-04-01*
