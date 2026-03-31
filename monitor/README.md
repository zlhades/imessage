# Incident Monitor

> AI 驱动的事件监控工具 - 在 Claude Code / 通义千问中运行

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd monitor
npm install
```

### 2. 创建测试数据

```bash
# 创建示例消息文件
cat > data/incidents.jsonl << 'EOF'
{"ts": "1711953600", "user": "user1", "text": "API 服务返回 500 错误！"}
{"ts": "1711953601", "user": "user2", "text": "我也是，从 10 分钟前开始的"}
{"ts": "1711953602", "user": "user1", "text": "影响支付功能，错误率 80%"}
EOF
```

### 3. 运行监控

```bash
# 启动监控（每 30 秒检查一次）
node bin/monitor.js data/incidents.jsonl

# 或指定间隔（60 秒）
node bin/monitor.js data/incidents.jsonl --interval 60
```

### 4. 添加新消息（另一个终端）

```bash
echo '{"ts": "1711953603", "user": "user3", "text": "正在调查..."}' >> data/incidents.jsonl
```

监控器会检测到新消息并提示你发送给 AI 分析。

---

## 📋 命令

| 命令 | 说明 |
|------|------|
| `node bin/monitor.js <file>` | 启动监控 |
| `node bin/monitor.js <file> --interval 60` | 指定间隔（秒） |
| `node bin/monitor.js <file> --status` | 查看状态 |
| `node bin/monitor.js <file> --analyze` | 单次分析 |
| `node bin/monitor.js --list` | 列出所有监控 |
| `node bin/monitor.js <file> --stop` | 停止监控 |

---

## 🔄 工作流程

```
1. 启动监控 → node bin/monitor.js data/incidents.jsonl
       ↓
2. 定时读取文件（每 30 秒）
       ↓
3. 有新消息？
   ├─ 是 → 显示消息 + AI 分析 Prompt → 继续
   └─ 否 → 等待（不消耗 token）→ 继续
       ↓
4. 检测到结束标记？
   ├─ 是 → 停止监控
   └─ 否 → 继续循环
```

---

## 📁 消息格式

每行一条 JSON：

```json
{"ts": "1711953600", "user": "user1", "text": "消息内容"}
```

**字段**:
- `ts`: 时间戳（秒，字符串）
- `user`: 用户 ID
- `text`: 消息内容

---

## 🤖 AI 集成

### 通义千问（Qwen）

**待实现**: MCP Server 配置

### Claude Code

**待实现**: MCP Server 配置

---

## 🧪 测试

```bash
npm test
```

---

## 📊 状态文件

监控状态保存在 `data/{channel}-state.json`:

```json
{
  "channel": "data/incidents.jsonl",
  "lastReadTs": "1711953602",
  "processedIds": ["1711953600", "1711953601"],
  "isActive": true,
  "startTime": "2026-03-31T10:00:00.000Z",
  "context": {
    "messageCount": 5,
    "lastActivity": "2026-03-31T10:05:00.000Z"
  }
}
```

---

## 🎯 结束标记

以下关键词会触发自动停止：

- `已解决`
- `已修复`
- `resolved`
- `fixed`
- `closed`
- `结束`
- `incident closed`
- `[CLOSED]`

---

## 💡 使用场景

### 场景 1: 本地文件监控

```bash
# 1. 启动监控
node bin/monitor.js data/my-incident.jsonl

# 2. 在另一个终端添加消息
echo '{"ts": "1", "user": "me", "text": "问题描述"}' >> data/my-incident.jsonl

# 3. 监控器检测到后，提示发送给 AI 分析
```

### 场景 2: Slack Thread 导出

```bash
# 1. 从 Slack 导出 thread 到文件
# 2. 启动监控
node bin/monitor.js data/slack-export.jsonl
```

---

## 🔧 开发

```bash
# 开发模式（自动重启）
npm run dev

# 运行测试
npm test
```

---

*Incident Monitor v1.0 | 2026-03-31*
