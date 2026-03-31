# Incident Monitor MCP 配置

> 在 AI 内部运行监控服务

---

## 🎯 使用场景

### 场景 1: 在 Claude Code 中使用

**步骤**:

1. **配置 MCP Server**

在 Claude Code 的配置中添加：

```json
{
  "mcpServers": {
    "incident-monitor": {
      "command": "node",
      "args": ["/path/to/monitor/mcp-server.js"],
      "cwd": "/path/to/monitor"
    }
  }
}
```

2. **在对话中使用**

```
用户：请开始监控 data/incident.jsonl

AI: [调用 incident_start_monitoring 工具]
    好的，我已开始监控 data/incident.jsonl，每 30 秒检查一次新消息。

[30 秒后]

AI: [调用 incident_get_new_messages 工具]
    发现 2 条新消息：
    [14:30:00] user1: API 错误率上升到 50%
    [14:30:15] user2: 正在检查日志
    
    请分析以上消息...
```

---

### 场景 2: 在通义千问中使用

**步骤**:

1. **配置 MCP**

在通义千问的配置中添加相同的 MCP Server 配置。

2. **在对话中使用**

```
/monitor data/incident.jsonl

AI: 开始监控...
```

---

## 🛠️ MCP 工具

### incident_start_monitoring

**功能**: 开始监控一个事件频道

**参数**:
```json
{
  "channel": "data/incident.jsonl",
  "interval": 30  // 轮询间隔（秒）
}
```

**返回**:
```json
{
  "status": "started",
  "channel": "data/incident.jsonl",
  "interval": 30,
  "message": "已开始监控 data/incident.jsonl，每 30 秒检查一次"
}
```

---

### incident_get_new_messages

**功能**: 获取自上次检查以来的新消息

**参数**:
```json
{
  "channel": "data/incident.jsonl"
}
```

**返回**:
```json
{
  "status": "has_new_messages",
  "channel": "data/incident.jsonl",
  "messageCount": 2,
  "messages": [
    {"ts": "1", "user": "user1", "text": "API 错误"},
    {"ts": "2", "user": "user2", "text": "正在调查"}
  ],
  "formatted": "[14:30:00] user1: API 错误\n[14:30:15] user2: 正在调查",
  "hasEndMarker": false
}
```

---

### incident_stop_monitoring

**功能**: 停止监控

**参数**:
```json
{
  "channel": "data/incident.jsonl"
}
```

**返回**:
```json
{
  "status": "stopped",
  "channel": "data/incident.jsonl",
  "message": "已停止监控 data/incident.jsonl"
}
```

---

### incident_get_status

**功能**: 获取监控状态

**参数**:
```json
{
  "channel": "data/incident.jsonl"
}
```

**返回**:
```json
{
  "status": "monitoring",
  "channel": "data/incident.jsonl",
  "interval": 30000,
  "lastReadTs": "2",
  "isActive": true,
  "startTime": "2026-03-31T10:00:00.000Z",
  "messageCount": 5
}
```

---

## 📋 完整工作流

### 1. 启动监控

```
用户：开始监控 data/incident.jsonl

AI: [调用 incident_start_monitoring]
    好的，已开始监控。
```

### 2. 定时检查（AI 内部循环）

```
[AI 内部定时器，每 30 秒]
AI: [调用 incident_get_new_messages]
    没有新消息。

[30 秒后]
AI: [调用 incident_get_new_messages]
    发现 2 条新消息：
    [14:30:00] user1: API 错误率上升到 50%
    [14:30:15] user2: 正在检查日志
    
    请分析...
```

### 3. 分析并回复

```
AI: 根据以上消息分析：
    1. 问题类型：生产事件
    2. 严重性：P1（大面积影响）
    3. 缺失信息：具体哪个服务、错误类型
    4. 建议：询问具体服务名和错误日志
```

### 4. 检测结束

```
[用户添加消息：已修复 [CLOSED]]

AI: [调用 incident_get_new_messages]
    检测到结束标记！
    
    事件已结束，总结处理过程...
```

### 5. 停止监控

```
AI: [调用 incident_stop_monitoring]
    已停止监控。
    
    事件总结：
    - 持续时间：30 分钟
    - 参与人员：3 人
    - 根本原因：数据库连接池满
    - 解决方案：增加连接池大小
```

---

## 🔧 测试 MCP Server

### 1. 启动服务器

```bash
cd monitor
node mcp-server.js
```

输出：
```
[MCP] 启动 Incident Monitor MCP Server...
[MCP] MCP Server 已启动
```

### 2. 测试工具调用

使用 MCP 测试工具或手动发送 JSON-RPC 请求：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "incident_start_monitoring",
    "arguments": {
      "channel": "data/test.jsonl",
      "interval": 5
    }
  }
}
```

### 3. 验证响应

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\"status\":\"started\",\"channel\":\"data/test.jsonl\",\"interval\":5}"
    }]
  }
}
```

---

## 📊 与命令行版本对比

| 特性 | 命令行版本 | MCP Server 版本 |
|------|-----------|----------------|
| **运行位置** | 终端 | AI 内部 |
| **触发方式** | 用户执行命令 | AI 调用工具 |
| **控制权** | 用户 | AI |
| **集成度** | 低 | 高 |
| **使用场景** | 独立使用 | AI 辅助 |

---

## 🎯 推荐使用方式

**推荐**: 使用 **MCP Server 版本**

**原因**:
1. AI 可以直接控制
2. 自动定时检查
3. 自动分析新消息
4. 完整的 AI 工作流集成

**命令行版本用途**:
- 快速测试
- 独立使用（不需要 AI）
- 调试

---

## 📁 配置文件位置

### Claude Code

```
~/.claude-code/config.json
```

添加：
```json
{
  "mcpServers": {
    "incident-monitor": {
      "command": "node",
      "args": ["/absolute/path/to/monitor/mcp-server.js"],
      "cwd": "/absolute/path/to/monitor"
    }
  }
}
```

### 通义千问

配置位置取决于具体实现，通常类似。

---

*MCP 配置指南 | 2026-03-31*
