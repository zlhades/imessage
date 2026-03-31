# MCP Server 测试指南

> 包含日志记录和已知 BUG
> 
> **测试日期**: 2026-03-31

---

## 🎯 测试目标

1. 验证 MCP Server 能在 Qwen CLI 中工作
2. 支持简单文本格式（每行一条消息）
3. 日志记录便于调试
4. **发现并修复已知的 BUG**

---

## 📁 测试准备

### 1. 创建测试文件

```bash
cd /Users/benson/Documents/incident/monitor

# 创建简单文本格式的测试文件（不需要 JSON）
cat > data/test-incident.txt << 'EOF'
API 服务返回 500 错误！
我也看到了，从 5 分钟前开始
有人知道怎么回事吗？
EOF
```

**文件格式说明**:
- ✅ 简单文本：每行一条消息
- ✅ JSON 格式：也支持

---

### 2. 启动 MCP Server

```bash
cd /Users/benson/Documents/incident/monitor

# 方式 1: 普通模式（只记录错误）
node mcp-server.js

# 方式 2: 调试模式（记录所有日志）
DEBUG=true node mcp-server.js
```

**预期输出**:
```
[MCP INFO] 启动 Incident Monitor MCP Server...
[MCP INFO] MCP Server 已启动
```

---

### 3. 配置 Qwen CLI

在 Qwen CLI 的配置中添加：

```json
{
  "mcpServers": {
    "incident-monitor": {
      "command": "node",
      "args": ["/Users/benson/Documents/incident/monitor/mcp-server.js"],
      "cwd": "/Users/benson/Documents/incident/monitor"
    }
  }
}
```

---

## 🧪 测试步骤

### 测试 1: 启动监控

**在 Qwen CLI 对话中**:

```
你：请开始监控 /Users/benson/Documents/incident/monitor/data/test-incident.txt

AI: [调用 incident_start_monitoring 工具]
    好的，已开始监控...
```

**预期日志** (`logs/mcp-server.log`):
```json
{"timestamp":"2026-03-31T10:00:00.000Z","level":"info","message":"收到启动监控请求","channel":"/Users/.../data/test-incident.txt","interval":30}
{"timestamp":"2026-03-31T10:00:00.001Z","level":"info","message":"开始监控","channel":"/Users/.../data/test-incident.txt"}
```

---

### 测试 2: 获取消息（第一次）

**在 Qwen CLI 对话中**:

```
你：检查新消息

AI: [调用 incident_get_new_messages 工具]
    发现 3 条新消息：
    [10:00:00] unknown: API 服务返回 500 错误！
    [10:00:01] unknown: 我也看到了，从 5 分钟前开始
    [10:00:02] unknown: 有人知道怎么回事吗？
```

**预期日志**:
```json
{"level":"info","message":"收到获取新消息请求","channel":"/Users/.../data/test-incident.txt"}
{"level":"info","message":"读取文件","filePath":"/Users/.../data/test-incident.txt","lastMessageIndex":0}
{"level":"info","message":"发现新消息","messageCount":3,"messages":[...]}
```

---

### 测试 3: 获取消息（第二次）🐛

**在 Qwen CLI 对话中**:

```
你：再检查一次

AI: [调用 incident_get_new_messages 工具]
    ❌ 发现 3 条新消息：（相同的消息！）
    [10:00:00] unknown: API 服务返回 500 错误！
    ...
```

**预期行为**: 应该返回"没有新消息"
**实际行为**: 返回相同的消息（**BUG**）

**日志**:
```json
{"level":"info","message":"发现新消息","messageCount":3}
// ❌ 注意：lastMessageIndex 没有被更新
```

---

### 测试 4: 添加新消息

**在另一个终端**:

```bash
echo "正在检查日志..." >> data/test-incident.txt
```

**在 Qwen CLI 对话中**:

```
你：有新消息吗

AI: [调用 incident_get_new_messages 工具]
    发现 4 条新消息：（包括之前的 3 条 + 新的 1 条）
```

**预期行为**: 应该只返回 1 条新消息
**实际行为**: 返回所有消息（**BUG**）

---

### 测试 5: 结束标记检测

**添加结束消息**:

```bash
echo "已修复 [CLOSED]" >> data/test-incident.txt
```

**在 Qwen CLI 对话中**:

```
你：检查新消息

AI: [调用 incident_get_new_messages 工具]
    发现 N 条新消息...
    检测到结束标记，事件已结束。
```

**预期日志**:
```json
{"level":"info","message":"检测到结束标记","keyword":"[CLOSED]"}
```

---

## 🐛 已知 BUG

### BUG 描述

**位置**: `mcp-server.js` 第 364 行

**问题**: `lastMessageIndex` 没有被更新

**代码**:
```javascript
// 🐛 BUG: 更新 lastMessageIndex 时使用了错误的值
state.messageCount += newMessages.length;
// state.lastMessageIndex = state.lastMessageIndex + newMessages.length; // ❌ 忘记取消注释这行！
```

**影响**: 
- 每次调用 `incident_get_new_messages` 都返回所有消息
- 无法正确跟踪已读消息

---

### 修复方法

**取消注释第 364 行**:

```javascript
// 修复后：
state.messageCount += newMessages.length;
state.lastMessageIndex = state.lastMessageIndex + newMessages.length; // ✅ 取消注释
```

**完整代码** (`mcp-server.js` 第 360-370 行):

```javascript
async function handleGetNewMessages(args) {
  // ... 前面的代码
  
  // 🐛 BUG 修复：
  state.messageCount += newMessages.length;
  state.lastMessageIndex = state.lastMessageIndex + newMessages.length; // ✅ 取消注释这行
  
  // ... 后面的代码
}
```

---

## 📊 日志分析

### 日志文件位置

```
/Users/benson/Documents/incident/monitor/logs/mcp-server.log
```

### 查看日志

```bash
# 实时查看
tail -f logs/mcp-server.log

# 查看错误
grep '"level":"error"' logs/mcp-server.log

# 查看特定消息
grep '发现新消息' logs/mcp-server.log
```

### 日志格式

```json
{
  "timestamp": "2026-03-31T10:00:00.000Z",
  "level": "info",
  "message": "收到获取新消息请求",
  "channel": "data/test-incident.txt",
  "lastMessageIndex": 0
}
```

---

## ✅ 测试检查清单

### 基础功能

- [ ] MCP Server 能启动
- [ ] 能配置到 Qwen CLI
- [ ] `incident_start_monitoring` 工作
- [ ] `incident_get_new_messages` 返回消息
- [ ] `incident_stop_monitoring` 工作
- [ ] `incident_get_status` 工作

### 文件格式

- [ ] 支持简单文本格式（每行一条消息）
- [ ] 支持 JSON 格式
- [ ] 自动检测格式

### 日志记录

- [ ] 日志文件创建
- [ ] 记录启动请求
- [ ] 记录获取消息
- [ ] 记录错误

### BUG 验证

- [ ] 发现 BUG（重复返回消息）
- [ ] 查看日志确认 `lastMessageIndex` 未更新
- [ ] 修复 BUG
- [ ] 验证修复后正常

---

## 🎯 完整测试对话示例

```
你：请监控 /Users/benson/Documents/incident/monitor/data/test-incident.txt

AI: 好的，已开始监控...

你：检查新消息

AI: 发现 3 条新消息：
    [10:00:00] unknown: API 服务返回 500 错误！
    [10:00:01] unknown: 我也看到了
    [10:00:02] unknown: 有人知道怎么回事吗？

你：再检查一次

AI: ❌ 发现 3 条新消息：（相同的消息！）
    [10:00:00] unknown: API 服务返回 500 错误！
    ...
    
你：（查看日志，发现 BUG）

你：（修复 mcp-server.js 第 364 行）

你：重启 MCP Server

你：再检查一次

AI: ✅ 没有新消息

你：（另一个终端添加消息）

你：有新消息吗

AI: ✅ 发现 1 条新消息：
    [10:05:00] unknown: 正在检查日志...
```

---

## 📝 测试报告模板

```markdown
## 测试结果

**测试日期**: 2026-03-31
**测试环境**: Qwen CLI

### 测试步骤

1. MCP Server 启动：✅/❌
2. 配置到 Qwen CLI: ✅/❌
3. 启动监控：✅/❌
4. 获取消息：✅/❌
5. 重复获取（发现 BUG）: ✅/❌
6. 修复 BUG: ✅/❌
7. 验证修复：✅/❌

### 日志分析

- 日志文件创建：✅/❌
- 关键日志记录：✅/❌
- 错误追踪：✅/❌

### 发现的问题

1. [x] lastMessageIndex 未更新（已修复）
2. [ ] 其他问题...

### 截图/日志

[粘贴相关日志]
```

---

## 🔧 调试技巧

### 1. 启用调试模式

```bash
DEBUG=true node mcp-server.js
```

### 2. 实时查看日志

```bash
tail -f logs/mcp-server.log
```

### 3. 检查状态

```
你：检查监控状态

AI: [调用 incident_get_status]
    状态：{
      "channel": "data/test-incident.txt",
      "lastMessageIndex": 0,  // ❌ 应该是 3
      "messageCount": 3
    }
```

---

*测试指南 | 2026-03-31*
