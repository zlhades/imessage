# File 模式使用指南

> 无需 Slack，使用文件模拟消息队列进行开发和测试
>
> **包含**: 快速参考 + 详细指南 + 实现说明

---

## 🚀 一分钟开始

```bash
# 1. 安装
npm install

# 2. 构建 File MCP Server
cd mcp-servers/file && npm install && npm run build && cd ../..

# 3. 创建示例消息
node dist/file-mode.js --create-sample

# 4. 运行
npm run dev

# 5. 查看回复
node dist/file-mode.js --view data/output.jsonl
```

**核心文件**:
- `data/messages.jsonl` - 输入消息
- `data/output.jsonl` - 机器人回复

**消息格式**:
```json
{"ts": "1711953600", "user": "user1", "text": "消息内容"}
```

---

## 📖 概述

File 模式使用 JSONL 文件（每行一条 JSON 记录）模拟 Slack 消息队列，让你可以：

- ✅ 在本地开发和测试，无需 Slack
- ✅ 运行 E2E 测试，验证完整流程
- ✅ 快速原型验证和演示
- ✅ 未来无缝迁移到 Slack

---

## 🚀 快速开始

### 1. 构建 File MCP Server

```bash
cd mcp-servers/file
npm install
npm run build
```

### 2. 创建示例消息

```bash
# 在项目根目录运行
node dist/file-mode.js --create-sample
```

这会在 `data/messages.jsonl` 创建 3 条示例消息：

```json
{"ts": "1711953600", "user": "user1", "text": "大家好，API 服务突然返回 500 错误！"}
{"ts": "1711953601", "user": "user2", "text": "我也是，从 10 分钟前开始的。"}
{"ts": "1711953602", "user": "user1", "text": "有人知道怎么回事吗？"}
```

### 3. 查看消息

```bash
node dist/file-mode.js --view
```

### 4. 运行机器人

```bash
# 确保配置使用 File MCP Server
# config/mcp.yaml 中：
# file:
#   enabled: true
# slack:
#   enabled: false

npm run dev
```

### 5. 查看机器人回复

```bash
node dist/file-mode.js --view data/output.jsonl
```

---

## 📁 文件格式

### 输入文件：`data/messages.jsonl`

每行一条 JSON 消息：

```json
{"ts": "1711953600", "user": "user1", "text": "消息内容", "thread_ts": "可选"}
```

**字段说明**：
- `ts`: 时间戳（秒，字符串格式）
- `user`: 用户 ID
- `text`: 消息内容
- `thread_ts`: （可选）线程 ID，如果是回复某条消息

### 输出文件：`data/output.jsonl`

机器人发送的消息会写入此文件，格式相同。

---

## 🔧 命令行工具

`file-mode.ts` 提供以下命令：

### 创建示例消息

```bash
node dist/file-mode.js --create-sample [文件路径]
```

默认创建到 `data/messages.jsonl`

### 查看消息

```bash
node dist/file-mode.js --view [文件路径]
```

默认查看 `data/messages.jsonl`

### 清空消息

```bash
node dist/file-mode.js --clear [文件路径]
```

---

## 🧪 运行 E2E 测试

```bash
# 运行所有 File 模式测试
npm test -- tests/e2e/file-mode.test.ts

# 运行特定测试
npm test -- tests/e2e/file-mode.test.ts -t "应该模拟完整的事件响应流程"
```

### 测试覆盖

| 测试类别 | 测试数量 | 说明 |
|---------|---------|------|
| File MCP Server | 7 | 基础功能测试 |
| 完整流程 | 2 | 端到端场景测试 |
| 边界情况 | 6 | 异常处理测试 |
| **总计** | **15** | **100% 通过** |

---

## 📝 使用示例

### 示例 1: 模拟问题报告

```bash
# 清空现有消息
node dist/file-mode.js --clear

# 添加问题报告
echo '{"ts": "1711953600", "user": "oncall", "text": "生产环境 API 响应超时"}' >> data/messages.jsonl
echo '{"ts": "1711953601", "user": "dev1", "text": "我也看到了，从 5 分钟前开始"}' >> data/messages.jsonl

# 运行机器人
npm run dev

# 查看回复
node dist/file-mode.js --view data/output.jsonl
```

### 示例 2: 多轮对话

```bash
# 清空
node dist/file-mode.js --clear

# 添加对话
cat > data/messages.jsonl << 'EOF'
{"ts": "1000000001", "user": "user1", "text": "数据库连接超时"}
{"ts": "1000000002", "user": "bot", "text": "收到，正在调查..."}
{"ts": "1000000003", "user": "user1", "text": "有人知道吗？"}
{"ts": "1000000004", "user": "user2", "text": "我看看日志"}
{"ts": "1000000005", "user": "user2", "text": "找到了，是连接池满了"}
EOF

# 查看
node dist/file-mode.js --view
```

### 示例 3: 添加新消息触发响应

```bash
# 初始消息
echo '{"ts": "1000000001", "user": "user1", "text": "服务报错"}' > data/messages.jsonl

# 运行机器人（会读取并分析）
npm run dev

# 添加新消息
echo '{"ts": "1000000002", "user": "user1", "text": "错误率 80%，影响支付功能"}' >> data/messages.jsonl

# 再次运行（会检测新消息）
npm run dev
```

---

## 🔄 迁移到 Slack

当你准备好使用 Slack 时：

### 1. 修改配置

```yaml
# config/mcp.yaml
mcp:
  servers:
    file:
      enabled: false  # 禁用 File 模式
    
    slack:
      enabled: true   # 启用 Slack 模式
      command: node
      args:
        - ./mcp-servers/slack/dist/index.js
      env:
        SLACK_BOT_TOKEN: ${SLACK_BOT_TOKEN}
```

### 2. 安装 Slack MCP Server

```bash
cd mcp-servers/slack
npm install
npm run build
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 Slack Token
```

### 4. 运行

```bash
npm run dev
```

**无需修改任何业务代码！**

---

## 🛠️ API 参考

### TypeScript API

```typescript
import {
  readMessages,
  writeBotResponse,
  getNewMessages,
  clearMessages,
} from './src/file-mode.js';

// 读取消息
const messages = readMessages('data/messages.jsonl');

// 写入回复
writeBotResponse('data/output.jsonl', '收到，正在调查...');

// 检测新消息
const newMsgs = getNewMessages('data/messages.jsonl', lastCheckTs);

// 清空
clearMessages('data/messages.jsonl');
```

### MCP 工具

File MCP Server 提供以下工具：

| 工具 | 说明 | 参数 |
|------|------|------|
| `file_get_messages` | 读取消息 | file, limit, oldest |
| `file_send_message` | 写入消息 | file, text, thread_ts, user |
| `file_check_new_messages` | 检查新消息 | file, since_ts |
| `file_clear_messages` | 清空文件 | file |

---

## 📊 项目结构

```
incident/
├── mcp-servers/
│   └── file/              # File MCP Server
│       ├── src/index.ts   # Server 实现
│       ├── package.json
│       └── dist/          # 编译输出
├── src/
│   └── file-mode.ts       # File 模式工具库
├── data/
│   ├── messages.jsonl     # 输入消息（模拟 Slack）
│   └── output.jsonl       # 输出消息（机器人回复）
├── tests/e2e/
│   └── file-mode.test.ts  # E2E 测试
└── config/
    ├── mcp.yaml           # MCP 配置
    └── file.yaml          # File 模式配置
```

---

## 🎯 最佳实践

### 1. 消息格式

保持消息简洁，一行一条：

```bash
# ✅ 好
echo '{"ts": "1000", "user": "u1", "text": "问题描述"}' >> data/messages.jsonl

# ❌ 不好：多行 JSON
echo '{
  "ts": "1000",
  "user": "u1",
  "text": "问题描述"
}' >> data/messages.jsonl
```

### 2. 时间戳

使用秒级时间戳（字符串格式）：

```typescript
const ts = String(Date.now() / 1000);  // ✅
```

### 3. 测试隔离

E2E 测试使用独立的测试目录：

```typescript
const TEST_DATA_DIR = 'data/test-e2e';  // 不是 data/
```

### 4. 清理

测试后清理临时文件：

```bash
rm -rf data/test-e2e/
```

---

## 🐛 故障排查

### 问题：机器人不响应

**检查**：
1. 消息文件格式是否正确
2. `config/mcp.yaml` 中 `file.enabled: true`
3. 查看日志：`logs/*.log`

### 问题：消息重复处理

**解决**：
- 检查 `data/state.json` 中的已处理消息 ID
- 或运行 `node dist/file-mode.js --clear`

### 问题：JSON 解析错误

**原因**：文件中有格式错误的行

**解决**：
```bash
# 验证 JSON 格式
cat data/messages.jsonl | while read line; do echo "$line" | jq .; done
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [README.md](../README.md) | 项目总览 |
| [PLAN.md](../PLAN.md) | 实施计划 |
| [TESTING.md](../TESTING.md) | 测试指南 |
| [tests/e2e/file-mode.test.ts](../tests/e2e/file-mode.test.ts) | E2E 测试代码 |

---

*最后更新：2026-03-31*
