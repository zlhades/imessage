# Qwen Code iMessage Skill - 读取并执行

## 🎯 功能

现在 Qwen Code 可以直接使用以下命令：

| 命令 | 说明 |
|------|------|
| `/imessage read <联系人>` | 读取最后一条消息 |
| `/imessage execute <联系人>` | 读取并分析执行 |
| `/imessage search <联系人> [数量]` | 搜索消息 |

---

## 🚀 使用方法

### 在 Qwen Code 对话中

**1. 读取消息：**
```
读取 zlhades@icloud.com 的最后一条消息
```

**2. 读取并执行：**
```
执行 zlhades@icloud.com 的最后一条消息
```

**3. 搜索消息：**
```
搜索 zlhades@icloud.com 的最近 5 条消息
```

---

## 📋 配置步骤

### 步骤 1: 更新 MCP 配置

编辑 `~/.qwen/settings.json`，确保有：

```json
{
  "mcp": {
    "servers": {
      "imessage": {
        "command": "python3",
        "args": ["/Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py"],
        "description": "iMessage 读取与执行"
      }
    }
  }
}
```

### 步骤 2: 赋予执行权限

```bash
chmod +x /Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py
```

### 步骤 3: 重启 Qwen Code

```bash
killall "Qwen Code"
open -a "Qwen Code"
```

---

## 🧪 测试

### 测试 1: 读取消息

在 Qwen Code 中说：
```
读取 zlhades@icloud.com 的最后一条消息
```

预期输出：
```
📱 来自 zlhades@icloud.com 的最后一条消息：
📅 时间：2026-04-01 07:50:42
💬 内容：我是想做这样的事情...
```

### 测试 2: 执行消息

在 Qwen Code 中说：
```
执行 zlhades@icloud.com 的最后一条消息
```

预期输出：
```
📱 消息内容：...
🔍 分析结果：这是一个创建文件的指令
✅ 执行中...
```

---

## 🔧 命令行测试

```bash
# 读取消息
python3 /Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py read "zlhades@icloud.com"

# 执行消息
python3 /Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py execute "zlhades@icloud.com"

# 搜索消息
python3 /Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py search "zlhades@icloud.com" 5
```

---

## 📝 示例对话

**用户**: 执行 zlhades@icloud.com 的最后一条消息

**Qwen**: 
```
📱 读取到来自 zlhades@icloud.com 的消息：

"我是想做这样的事情，第一阶段我想做的就是：
1. 发一个 iMessage 到电脑
2. 在千问里面用一个命令行去读这个信息
3. 在千问里面执行"

🔍 分析结果：
- 指令类型：工作流描述
- 建议操作：完成 iMessage 读取和执行的集成

✅ 正在执行...

已完成以下任务：
1. ✅ 创建 iMessage 读取工具
2. ✅ 集成到 Qwen Code
3. ✅ 支持自动执行

还需要什么帮助吗？
```

---

## ⚠️ 注意事项

1. **权限**：需要授予终端完全磁盘访问权限
2. **数据库**：`~/Library/Messages/chat.db`
3. **仅 macOS**：此功能仅在 macOS 上可用

---

*Qwen Code iMessage Skill | 2026-04-01*
