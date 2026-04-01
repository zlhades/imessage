# iMessage MCP Server - 完整配置

## 🎯 功能

让 Qwen Code **原生支持** iMessage，可以直接在对话中：
- 读取消息
- 执行指令
- 自动监听

---

## 📋 安装步骤

### 步骤 1: 安装依赖

```bash
cd /Users/benson/Documents/incident/skills/imessage
npm init -y
npm install @modelcontextprotocol/sdk
```

### 步骤 2: 配置 Qwen Code

编辑 `~/.qwen/settings.json`，添加：

```json
{
  "mcp": {
    "servers": {
      "imessage": {
        "command": "node",
        "args": ["/Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.js"],
        "cwd": "/Users/benson/Documents/incident/skills/imessage"
      }
    }
  }
}
```

### 步骤 3: 重启 Qwen Code

```bash
killall "Qwen Code"
open -a "Qwen Code"
```

---

## 🚀 使用方法

### 在 Qwen Code 对话中

**1. 读取消息：**
```
读取 zlhades@icloud.com 的最后一条消息
```

**2. 执行消息：**
```
执行 zlhades@icloud.com 的最后一条消息
```

**3. 搜索消息：**
```
搜索 zlhades@icloud.com 的最近 5 条消息
```

**4. 自动模式：**
```
检查所有联系人的新消息并执行
```

---

## 🔧 可用工具

| 工具 | 说明 | 参数 |
|------|------|------|
| `imessage_read` | 读取最新消息 | contact |
| `imessage_execute` | 读取并分析执行 | contact |
| `imessage_search` | 搜索消息 | contact, limit |
| `imessage_auto` | 自动读取所有联系人 | 无 |

---

## 📝 示例对话

**用户**: 执行 zlhades@icloud.com 的最后一条消息

**Qwen**: 
```
[调用 imessage_execute 工具]

找到来自 zlhades@icloud.com 的最后一条消息：
📅 时间：2026-04-01 08:45:13
💬 内容：帮我创建一个文件...

正在执行...
✅ 文件已创建：/tmp/test.txt
```

---

## ⚠️ 注意事项

1. **权限**：需要完全磁盘访问权限
2. **Node.js**：需要 Node.js 16+
3. **仅 macOS**：iMessage 仅在 macOS 可用

---

*最后更新：2026-04-01*
