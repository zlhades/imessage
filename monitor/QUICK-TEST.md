# 快速测试指南

> 5 分钟开始测试 MCP Server

---

## 🚀 快速开始

### 1. 准备测试文件

```bash
cd /Users/benson/Documents/incident/monitor

# 创建简单文本格式的测试文件
cat > data/test-incident.txt << 'EOF'
API 服务返回 500 错误！
我也看到了，从 5 分钟前开始
有人知道怎么回事吗？
EOF
```

---

### 2. 在另一个 Qwen CLI 中测试

**步骤 1**: 配置 MCP

在 Qwen CLI 启动时或配置文件中添加：

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

**步骤 2**: 开始测试对话

```
你：请监控 /Users/benson/Documents/incident/monitor/data/test-incident.txt

AI: [调用工具 incident_start_monitoring]
    好的，已开始监控...

你：检查新消息

AI: [调用工具 incident_get_new_messages]
    发现 3 条新消息：
    [时间] unknown: API 服务返回 500 错误！
    [时间] unknown: 我也看到了，从 5 分钟前开始
    [时间] unknown: 有人知道怎么回事吗？

你：再检查一次

AI: [调用工具 incident_get_new_messages]
    ❌ 发现 3 条新消息：（相同的消息！）
    [BUG 表现]
    
你：（查看日志分析）
cat logs/mcp-server.log | tail -20
```

---

## 🐛 发现 BUG

**症状**: 每次检查都返回相同的消息

**日志位置**: `logs/mcp-server.log`

**查看日志**:
```bash
cd /Users/benson/Documents/incident/monitor
tail -20 logs/mcp-server.log
```

**预期日志**:
```json
{"level":"info","message":"发现新消息","messageCount":3}
// ❌ 注意 lastMessageIndex 没有被更新
```

---

## 🔧 修复 BUG

**文件**: `monitor/mcp-server.js`

**位置**: 第 364 行

**修复前**:
```javascript
state.messageCount += newMessages.length;
// state.lastMessageIndex = state.lastMessageIndex + newMessages.length; // ❌ 注释了
```

**修复后**:
```javascript
state.messageCount += newMessages.length;
state.lastMessageIndex = state.lastMessageIndex + newMessages.length; // ✅ 取消注释
```

**重启 MCP Server**:
```bash
# 找到并杀死旧进程
pkill -f mcp-server.js

# 重新启动
node mcp-server.js
```

---

## ✅ 验证修复

**再次测试**:

```
你：检查新消息

AI: 发现 3 条新消息

你：再检查一次

AI: ✅ 没有新消息  （修复成功！）

你：（另一个终端添加消息）
echo "正在检查日志..." >> data/test-incident.txt

你：有新消息吗

AI: ✅ 发现 1 条新消息：
    [时间] unknown: 正在检查日志...
```

---

## 📋 测试检查清单

- [ ] MCP Server 能启动
- [ ] 配置到 Qwen CLI
- [ ] 启动监控成功
- [ ] 第一次获取消息成功
- [ ] 发现 BUG（重复消息）
- [ ] 查看日志确认问题
- [ ] 修复 BUG
- [ ] 验证修复成功
- [ ] 添加新消息能检测到
- [ ] 结束标记能检测

---

## 📊 完整测试对话

```
========================================
测试会话开始
========================================

你：请监控 data/test-incident.txt

AI: 好的，已开始监控 data/test-incident.txt，每 30 秒检查一次。

你：检查新消息

AI: 发现 3 条新消息：
    [14:30:00] unknown: API 服务返回 500 错误！
    [14:30:01] unknown: 我也看到了，从 5 分钟前开始
    [14:30:02] unknown: 有人知道怎么回事吗？

你：再检查一次

AI: 发现 3 条新消息：  <-- 🐛 BUG!
    [14:30:00] unknown: API 服务返回 500 错误！
    [14:30:01] unknown: 我也看到了，从 5 分钟前开始
    [14:30:02] unknown: 有人知道怎么回事吗？

你：（查看日志）
$ tail -20 logs/mcp-server.log

你：（发现 lastMessageIndex 未更新）

你：（编辑 mcp-server.js，取消注释第 364 行）

你：（重启 MCP Server）

你：再检查一次

AI: ✅ 没有新消息  <-- 修复成功！

你：（另一个终端添加消息）
$ echo "正在检查日志..." >> data/test-incident.txt

你：有新消息吗

AI: ✅ 发现 1 条新消息：
    [14:35:00] unknown: 正在检查日志...

你：（添加结束标记）
$ echo "已修复 [CLOSED]" >> data/test-incident.txt

你：检查新消息

AI: 发现 1 条新消息：
    [14:40:00] unknown: 已修复 [CLOSED]
    检测到结束标记，事件已结束。

========================================
测试完成！
========================================
```

---

## 🎯 关键点

1. **文件格式**: 简单文本，每行一条消息
2. **日志位置**: `logs/mcp-server.log`
3. **BUG 位置**: `mcp-server.js` 第 364 行
4. **修复方法**: 取消注释 `state.lastMessageIndex` 更新行

---

*快速测试指南 | 2026-03-31*
