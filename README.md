# Slack AI Incident Response Bot

> AI 驱动的事件响应机器人，集成 Slack + MCP 架构，支持发送前双重确认和本地交互
>
> **✨ 新增：File 模式** - 无需 Slack，使用文件即可开发和测试！

---

## 📖 文档导航

### 核心文档（必读）

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| **[README.md](./README.md)** | 项目入口 | 👈 第一次查看 |
| **[QUICK-START.md](./QUICK-START.md)** | 快速开始 | 👈 首次运行 |
| **[REQUIREMENTS.md](./REQUIREMENTS.md)** | 需求规格书 | 查看完整需求 |
| **[FILE-MODE-GUIDE.md](./FILE-MODE-GUIDE.md)** | File 模式指南 | 使用 File 模式 |

### 设计与架构

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| **[PLAN.md](./PLAN.md)** | 主实施计划 | 了解项目全貌 |
| **[PLAN-MCP-ARCHITECTURE.md](./PLAN-MCP-ARCHITECTURE.md)** | 详细架构 | 实现模块时参考 |

### 测试与完成

| 文档 | 说明 | 何时阅读 |
|------|------|----------|
| **[TESTING.md](./TESTING.md)** | 测试指南 | 运行测试时 |
| **[COMPLETE.md](./COMPLETE.md)** | 完成总结 | 了解已完成功能 |

**总计**: 7 个核心文档，4 个参考文档

---

## 🎯 项目目标

构建一个 Slack 集成的 AI 事件响应机器人，当事故发生时自动：
- 监控 Slack 频道讨论
- 理解对话状态并主动追问
- 调用工具调查问题（代码、日志、Metrics）
- 生成回复前让人类确认

---

## 💡 核心设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Qwen Code CLI                                    │
│                  (或未来 Claude Code)                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    MCP Servers                                  │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │ │
│  │  │   Slack MCP     │  │   GitHub MCP    │  │  Prometheus MCP │ │ │
│  │  │ - get_messages  │  │ - get_code      │  │ - get_metrics   │ │ │
│  │  │ - send_message  │  │ - get_commits   │  │ - query_logs    │ │ │
│  │  │ - check_new     │  │                 │  │                 │ │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 设计原则

| 原则 | 说明 |
|------|------|
| **MCP 架构** | 无状态，Pull 模式，简单可扩展 |
| **发送前双重确认** | Pull → Confirm → 再 Pull → 发送 |
| **本地交互** | 支持本地补充信息和指导 AI |
| **增量更新** | 默认不取消任务，合并新消息 |
| **无缝迁移** | 改配置即可从 Qwen 切换到 Claude |

---

## 🚀 快速开始

### 方式 1: File 模式（推荐，无需 Slack）

适合中国用户和本地开发：

```bash
# 1. 安装依赖
npm install

# 2. 构建 File MCP Server
cd mcp-servers/file && npm install && npm run build && cd ../..

# 3. 创建示例消息
node dist/file-mode.js --create-sample

# 4. 运行机器人
npm run dev
```

详细说明请查看 **[FILE-MODE-GUIDE.md](./FILE-MODE-GUIDE.md)**

---

### 方式 2: Slack 模式（生产环境）

需要 Slack Token 和国际网络：

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 SLACK_BOT_TOKEN 等

# 2. 构建 Slack MCP Server
cd mcp-servers/slack && npm install && npm run build && cd ../..

# 3. 修改配置
# config/mcp.yaml: 启用 slack，禁用 file

# 4. 运行
npm run dev
```

**下次继续实施时，请阅读 [QUICK-START.md](./QUICK-START.md)**

复制其中的 Prompt 发送给 AI 即可继续。

---

## 📊 实施进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| ✅ Phase 1 | 基础架构 (Week 1) | 已完成 |
| ✅ Phase 2 | AI 核心 (Week 2) | 已完成 |
| ✅ Phase 3 | 调查引擎 (Week 3) | 已完成 |
| ✅ Phase 4 | 发送前双重确认 (Week 4) | 已完成 |
| ✅ Phase 5 | 定时运行 + 状态持久化 (Week 5) | 已完成 |
| ✅ Phase 6 | 迁移准备 (内置) | 已完成 |

**完成总结**: 查看 [COMPLETE.md](./COMPLETE.md)

---

## 🛠️ 技术栈

| 模块 | 选型 |
|------|------|
| 运行时 | Node.js 20+ / TypeScript |
| MCP | @modelcontextprotocol/sdk |
| **消息源** | **File (本地开发)** / Slack (生产) |
| AI | DashScope SDK (OpenAI 兼容) |
| 配置 | YAML + dotenv |
| 日志 | Winston + JSON |
| 测试 | Vitest |

---

## 📁 项目结构

```
incident/
├── README.md                    # 本文件 - 项目入口
├── PLAN.md                      # 主实施计划
├── PLAN-MCP-ARCHITECTURE.md     # 详细 MCP 架构
├── QUICK-START.md               # 快速恢复指南
├── FILE-MODE-GUIDE.md           # 🆕 File 模式使用指南
├── src/
│   ├── index.ts                 # 主程序入口
│   ├── file-mode.ts             # 🆕 File 模式工具
│   ├── ai/                      # AI Provider
│   ├── mcp/                     # MCP Client
│   ├── analysis/                # 意图识别/完整性检查
│   ├── investigation/           # 调查引擎
│   └── approval/                # 发送前确认
├── mcp-servers/
│   ├── file/                    # 🆕 File MCP Server
│   ├── slack/                   # Slack MCP Server
│   ├── github/                  # GitHub MCP Server
│   └── prometheus/              # Prometheus MCP Server
├── config/                      # 配置文件
├── data/                        # 运行时数据
│   ├── messages.jsonl           # 🆕 输入消息（File 模式）
│   └── output.jsonl             # 🆕 输出消息（File 模式）
└── tests/
    ├── unit/                    # 单元测试
    ├── integration/             # 集成测试
    └── e2e/                     # 🆕 E2E 测试（含 File 模式）
```

---

## 📋 配置示例

### config/ai-backend.yaml

```yaml
provider:
  active: qwen  # 切换为 claude 即可迁移
  
  qwen:
    type: openai-compatible
    baseUrl: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    apiKey: ${QWEN_API_KEY}
    model: qwen3-coder-plus
    
  claude:
    type: anthropic
    baseUrl: https://api.anthropic.com
    apiKey: ${CLAUDE_API_KEY}
    model: claude-opus-4-6
```

---

## 🔑 需要的凭证

### File 模式（推荐）

✅ **无需任何凭证**，只需：

1. **Node.js 20+** 环境
2. 构建 File MCP Server

### Slack 模式（生产环境）

需要以下凭证：

1. **Slack App Token**
   - `SLACK_APP_TOKEN`
   - `SLACK_BOT_TOKEN`
   - `SLACK_SIGNING_SECRET`

2. **DashScope API Key**
   - `QWEN_API_KEY`

3. **其他 (可选)**
   - `GITHUB_TOKEN`（GitHub 调查）
   - `PROMETHEUS_URL` + `PROMETHEUS_API_KEY`（Prometheus 调查）

---

## 📝 相关命令

```bash
# 查看主计划
cat PLAN.md

# 查看架构详情
cat PLAN-MCP-ARCHITECTURE.md

# 查看快速开始指南
cat QUICK-START.md

# 查看 File 模式指南（推荐）
cat FILE-MODE-GUIDE.md

# File 模式快速开始
npm install
cd mcp-servers/file && npm install && npm run build && cd ../..
node dist/file-mode.js --create-sample
npm run dev

# 运行 E2E 测试
npm test -- tests/e2e/file-mode.test.ts
```

---

*最后更新：2026-03-19*
