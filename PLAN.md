# Slack AI Incident Response Bot - 实施计划

## 项目概述

**目标**: 构建一个 Slack 集成的 AI 事件响应机器人，当事故发生时自动：
- 监控 Slack 频道讨论
- 理解对话状态并主动追问
- 调用工具调查问题（代码、日志、Metrics）
- 生成回复前让人类确认

**设计原则**: 
- Qwen-first，预留 Claude Code 迁移路径
- **MCP 架构**: 无状态，Pull 模式，简单可扩展
- **发送前双重确认**: Pull → Confirm → 再 Pull → 发送
- **本地交互**: 支持本地补充信息和指导 AI

---

## 详细架构文档

完整的 MCP 架构设计、Slack MCP Server 实现、双重确认机制详见：

👉 **[PLAN-MCP-ARCHITECTURE.md](./PLAN-MCP-ARCHITECTURE.md)**

包含：
- MCP 协议详解
- Slack MCP Server 接口设计
- 发送前双重确认状态机
- 本地交互 CLI 设计
- 完整数据流图
- 项目结构与配置

---

## 系统架构 (MCP Pull 模式)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Qwen Code CLI                                    │
│                  (或未来 Claude Code)                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    AI Model                                     │ │
│  │                  (Qwen / Claude)                                │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                         │
│                           │ 调用 MCP 工具                            │
│                           ▼                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    MCP Servers                                  │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │ │
│  │  │   Slack MCP     │  │   GitHub MCP    │  │  Prometheus MCP │ │ │
│  │  │                 │  │                 │  │                 │ │ │
│  │  │ - get_messages  │  │ - get_code      │  │ - get_metrics   │ │ │
│  │  │ - send_message  │  │ - get_commits   │  │ - query_logs    │ │ │
│  │  │ - post_reply    │  │ - search_issues │  │ - alertmanager  │ │ │
│  │  │ - check_new     │  │                 │  │                 │ │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 数据流 (Pull 模式)

```
1. 定时触发 (cron 每 30 秒)
         ↓
2. 调用 Slack MCP: get_messages(channel="#incidents", limit=50)
         ↓
3. 合并本地输入 (如有)
         ↓
4. AI 分析最新消息:
   - 有新问题报告吗？
   - 有人提供新信息吗？
   - 信息完整吗？
         ↓
5. AI 决定行动:
   - 信息不足 → 生成追问，直接发送
   - 需要调查 → 调用 GitHub/Prometheus MCP
   - 有结论 → 进入发送前确认流程
         ↓
6. 发送前双重确认流程:
   ┌─────────────────────────────────────────────────────────────┐
   │  6a. 第一次 Pull → 生成回复草稿                              │
   │       ↓                                                     │
   │  6b. 本地显示草稿，等待用户 Confirm                          │
   │       ↓                                                     │
   │  用户选择:                                                   │
   │  ┌─────────┬─────────┬─────────┬─────────┐                 │
   │  │ [1] 确认 │ [2] 修改 │ [3] 再查 │ [4] 补充 │                 │
   │  └─────────┴─────────┴─────────┴─────────┘                 │
   │       ↓                                                     │
   │  6c. 用户 Confirm 后，发送前第二次 Pull                       │
   │       ↓                                                     │
   │  6d. 检查是否有新消息影响当前回复                            │
   │       ├─ 有新信息 → 重新分析，返回步骤 4                     │
   │       └─ 无新信息 → 发送消息到 Slack                         │
   └─────────────────────────────────────────────────────────────┘
         ↓
7. 退出（无状态，下次重新拉取）
```

---

## 核心功能模块

### 1. Slack MCP Server

**职责**: 提供 Slack 交互能力的 MCP 工具

| 工具 | 输入 | 输出 | 用途 |
|------|------|------|------|
| `slack_get_messages` | channel, limit, oldest, latest | 消息列表 | 拉取频道消息 |
| `slack_send_message` | channel, text, thread_ts | 发送结果 | 发送消息 |
| `slack_check_new_messages` | channel, since_ts | 是否有新消息 | 发送前二次确认 |
| `slack_get_thread_replies` | channel, thread_ts | 回复列表 | 获取线程回复 |

**实现**: 基于 `@modelcontextprotocol/sdk` + `@slack/web-api`

---

### 2. 本地交互 CLI

**职责**: 提供本地用户与 AI 的交互界面

**功能**:
- 显示 Slack 消息摘要
- 显示 AI 生成的回复草稿
- 接收用户确认/修改/补充指令
- 支持多行输入补充信息

**界面示例**:
```
============================================================
📤 准备发送以下回复到 Slack:
============================================================
频道：#incidents
------------------------------------------------------------
根据分析，错误率在 14:30 开始上升，可能与
最近的部署有关。建议：1) 检查部署变更 2) 查看
数据库连接池状态
------------------------------------------------------------

请选择操作:
  [1] ✓ 确认发送
  [2] ✏️ 修改草稿
  [3] 🔍 再调查
  [4] 💬 补充本地信息
  [5] ❌ 取消
============================================================

> _
```

---

### 3. 发送前双重确认 (Approval Gateway)

**职责**: 确保发送前消息仍然准确

**状态机**:
```
WAITING_CONFIRM → 用户 Confirm → PULL_2_CHECK → 无新消息 → SEND
                              ↓
                        有新消息 → REANALYZE
```

**关键逻辑**:
```typescript
// 第二次 Pull 检查
const newMessages = await mcp.slack_check_new_messages({
  channel: draft.channel,
  since_ts: draft.pull_ts,  // 第一次 Pull 的时间戳
});

if (newMessages.length > 0) {
  // 有新消息，需要重新分析
  return { status: 'REANALYZE', newMessages };
} else {
  // 无新消息，可以发送
  return { status: 'SEND' };
}
```

---

### 4. 上下文合并 (Context Merger)

**职责**: 合并 Slack 消息和本地输入，生成统一时间线

**数据结构**:
```typescript
interface MergedContext {
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  ts: string;
  type: 'SLACK_MESSAGE' | 'LOCAL_INPUT' | 'AI_ACTION';
  content: string;
  source: 'SLACK' | 'LOCAL';
  user?: string;
}
```

**合并逻辑**:
- Slack 消息：按时间戳排序
- 本地输入：插入到时间线对应位置
- AI 行动：记录每次调查/回复

---

### 5. AI Provider 抽象层

**职责**: 统一 Qwen/Claude 接口，支持无缝切换

**接口定义**:
```typescript
interface AIProvider {
  name: string;
  
  analyze(context: MergedContext): Promise<AnalysisResult>;
  
  generateResponse(analysis: AnalysisResult): Promise<string>;
  
  generateQuestions(missingInfo: string[]): Promise<string[]>;
  
  decideInvestigation(analysis: AnalysisResult): Promise<InvestigationPlan>;
}
```

**实现**:
- `QwenProvider`: 调用 DashScope API
- `ClaudeProvider`: 调用 Anthropic API (预留)

---

### 6. 调查引擎 (Investigation Engine)

**职责**: 根据 AI 决策调用 MCP 工具调查

**支持的工具**:
| 工具 | MCP Server | 用途 |
|------|------------|------|
| GitHub | `github-mcp` | 查代码变更、提交历史、PR |
| 日志系统 | `logs-mcp` | 查错误日志、访问日志 |
| Prometheus | `prometheus-mcp` | 查指标异常、告警 |

**调查流程**:
```
AI 决定调查 → 生成调查计划 → 调用 MCP 工具 → 汇总结果 → AI 分析
```

---

## 并发消息处理策略

### 默认策略：增量更新（不取消，合并新消息）

**核心原则**: 新消息到达时，不取消当前处理中的任务，而是将新消息合并到上下文中，等当前任务完成后再统一处理。

```
┌─────────────────────────────────────────────────────────────┐
│  当前状态：INVESTIGATING (正在分析日志...)                   │
│                                                             │
│  新消息到达 → 加入 pendingMessages 队列                      │
│  → 当前任务继续执行                                         │
│  → 任务完成后，用更新后的上下文重新评估                      │
│  → 决定下一步行动                                           │
└─────────────────────────────────────────────────────────────┘
```

### 优先级例外（可选配置）

| 优先级 | 触发条件 | 行为 |
|--------|----------|------|
| P0 - 立即中断 | P0 声明、服务完全不可用、@oncall | 取消当前任务，重新评估 |
| P1 - 合并处理 ✅ | 新信息补充、问题细节 | 加入上下文，等当前任务完成后处理 |
| P2 - 延后处理 | 闲聊、无关讨论 | 暂存，空闲时处理 |

**配置项**: `config/slack.yaml`
```yaml
concurrency:
  defaultStrategy: incremental  # incremental / cancel-and-restart
  urgentInterrupt: true         # 是否允许 P0 紧急中断
```

---

## 实施阶段

### Phase 1: 基础架构 (Week 1)

| 任务 | 描述 | 状态 |
|------|------|------|
| 1.1 | 项目初始化 (TypeScript + Node.js 20+) | ✅ 已完成 |
| 1.2 | Slack MCP Server 配置 | ✅ 已完成 |
| 1.3 | Qwen Code CLI 集成 | ✅ 已完成 |
| 1.4 | 本地交互界面 (CLI 输入/输出) | ✅ 已完成 |
| 1.5 | 日志系统 (Winston + JSON) | ✅ 已完成 |

**交付物**: 可从本地运行 `qwen incident`，拉取 Slack 消息并显示

---

### Phase 2: AI 核心 (Week 2)

| 任务 | 描述 | 状态 |
|------|------|------|
| 2.1 | AI Provider 抽象层定义 | ✅ 已完成 |
| 2.2 | Qwen Provider 实现 (DashScope API) | ✅ 已完成 |
| 2.3 | 意图识别模块 | ✅ 已完成 |
| 2.4 | 信息完整性检查器 | ✅ 已完成 |
| 2.5 | 追问逻辑实现 | ✅ 已完成 |
| 2.6 | Claude Provider 占位实现 | ✅ 已完成 |

**交付物**: AI 能理解意图、判断信息完整性、主动追问

---

### Phase 3: 调查引擎 (Week 3)

| 任务 | 描述 | 状态 |
|------|------|------|
| 3.1 | GitHub MCP 集成 (查代码/提交/PR) | ✅ 已完成 |
| 3.2 | 日志 MCP 集成 (查错误日志) | ✅ 已完成 |
| 3.3 | Prometheus MCP 集成 (查指标) | ✅ 已完成 |
| 3.4 | 调查结果汇总模块 | ✅ 已完成 |

**交付物**: AI 能主动调用工具调查问题

---

### Phase 4: 发送前双重确认 (Week 4)

| 任务 | 描述 | 状态 |
|------|------|------|
| 4.1 | 第一次 Pull → 生成回复草稿 | ✅ 已完成 |
| 4.2 | 本地确认界面 (Confirm/Modify/Investigate) | ✅ 已完成 |
| 4.3 | 发送前第二次 Pull 检查 | ✅ 已完成 |
| 4.4 | 新消息影响判断逻辑 | ✅ 已完成 |
| 4.5 | 本地信息补充功能 | ✅ 已完成 |

**交付物**: 发送前双重确认 + 本地交互完整流程

---

### Phase 5: 定时运行 + 状态持久化 (Week 5)

| 任务 | 描述 | 状态 |
|------|------|------|
| 5.1 | Cron 定时任务配置 | ✅ 已完成 |
| 5.2 | 已处理消息 ID 记录 | ✅ 已完成 |
| 5.3 | 本地状态缓存 (可选 Redis) | ✅ 已完成 |
| 5.4 | 失败重试机制 | ✅ 已完成 |

**交付物**: 可生产部署的定时运行架构

---

### Phase 6: 迁移准备 (内置)

| 任务 | 描述 | 状态 |
|------|------|------|
| 6.1 | 配置文件支持多 Provider | ✅ 已完成 |
| 6.2 | Provider Router 实现 | ✅ 已完成 |
| 6.3 | 迁移文档编写 | ✅ 已完成 |

**交付物**: 只需改配置即可切换 Claude Code

---

## 技术栈

| 模块 | 技术选型 | 理由 |
|------|----------|------|
| 运行时 | Node.js 20+ / TypeScript | Qwen Code CLI 同技术栈，MCP SDK 支持好 |
| Slack | @slack/web-api + MCP | 通过 MCP 协议集成，无需 Bolt |
| AI | DashScope SDK (OpenAI 兼容) | Qwen/Claude 都支持 |
| MCP | @modelcontextprotocol/sdk | 官方标准协议 |
| 配置 | YAML + dotenv | 行业标准 |
| 日志 | Winston + JSON 格式 | 结构化日志 |
| 测试 | Jest + Vitest | TypeScript 友好 |
| 状态存储 | 文件系统 (可扩展 Redis) | 简单场景足够 |

---

## 项目结构

```
incident/
├── src/
│   ├── index.ts                 # 入口 (CLI)
│   ├── cli/
│   │   ├── interactive.ts       # 本地交互界面
│   │   └── commands.ts          # CLI 命令定义
│   ├── mcp/
│   │   ├── client.ts            # MCP Client
│   │   └── servers/             # MCP Servers
│   │       ├── slack/           # Slack MCP Server
│   │       ├── github/          # GitHub MCP Server
│   │       └── prometheus/      # Prometheus MCP Server
│   ├── conversation/
│   │   ├── merge.ts             # Slack+ 本地合并
│   │   ├── context.ts           # 上下文管理
│   │   └── timeline.ts          # 时间线生成
│   ├── ai/
│   │   ├── provider.ts          # AI Provider 抽象接口
│   │   ├── qwen-provider.ts     # Qwen 实现
│   │   └── claude-provider.ts   # Claude 实现 (预留)
│   ├── analysis/
│   │   ├── intent.ts            # 意图识别
│   │   ├── completeness.ts      # 信息完整性检查
│   │   └── decision.ts          # 决策生成
│   ├── investigation/
│   │   └── engine.ts            # 调查引擎
│   ├── approval/
│   │   └── gateway.ts           # 发送前双重确认
│   └── config/
│       ├── index.ts             # 配置管理
│       └── schema.ts            # 配置 Schema
├── mcp-servers/
│   ├── slack/
│   │   ├── package.json
│   │   └── src/
│   ├── github/
│   └── prometheus/
├── config/
│   ├── ai-backend.yaml          # AI 后端配置
│   ├── slack.yaml               # Slack 配置
│   └── mcp.yaml                 # MCP Servers 配置
├── data/
│   └── state.json               # 运行时状态 (gitignore)
├── scripts/
│   ├── cron-runner.sh           # Cron 入口
│   └── setup.sh                 # 安装脚本
├── tests/
├── package.json
├── tsconfig.json
├── PLAN.md                      # 主计划 (本文件)
├── PLAN-MCP-ARCHITECTURE.md     # 详细 MCP 架构
└── README.md
```

---

## 配置文件示例

### config/ai-backend.yaml

```yaml
provider:
  active: qwen  # 切换为 claude 即可迁移
  
  qwen:
    type: openai-compatible
    baseUrl: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
    apiKey: ${QWEN_API_KEY}
    model: qwen3-coder-plus
    contextLimit: 256000
    
  claude:
    type: anthropic
    baseUrl: https://api.anthropic.com
    apiKey: ${CLAUDE_API_KEY}
    model: claude-opus-4-6
    # 企业部署
    # baseUrl: https://bedrock-runtime.us-east-1.amazonaws.com
    # authType: aws-iam
    
  fallback:
    enabled: true
    retryOnFailure: true
    maxRetries: 2
```

### config/slack.yaml

```yaml
slack:
  channels:
    incidents: '#incidents'
    oncall: '#oncall'
  
  polling:
    interval_seconds: 30
    message_limit: 50
    
  approval:
    require_double_check: true
    show_draft: true
    
  concurrency:
    defaultStrategy: incremental  # incremental / cancel-and-restart
    urgentInterrupt: true
```

### config/mcp.yaml

```yaml
mcp:
  servers:
    slack:
      command: node
      args:
        - ./mcp-servers/slack/dist/index.js
      env:
        SLACK_BOT_TOKEN: ${SLACK_BOT_TOKEN}
        SLACK_SIGNING_SECRET: ${SLACK_SIGNING_SECRET}
      
    github:
      command: node
      args:
        - ./mcp-servers/github/dist/index.js
      env:
        GITHUB_TOKEN: ${GITHUB_TOKEN}
        
    prometheus:
      command: node
      args:
        - ./mcp-servers/prometheus/dist/index.js
      env:
        PROMETHEUS_URL: ${PROMETHEUS_URL}
        PROMETHEUS_API_KEY: ${PROMETHEUS_API_KEY}
```

---

## 迁移到 Claude Code

### 迁移成本分析

| 模块 | Qwen 实现 | Claude Code 实现 | 迁移成本 |
|------|-----------|------------------|----------|
| MCP Servers | 标准协议 | 标准协议 (相同) | 无 |
| 本地交互 CLI | 自研 (不变) | 自研 (不变) | 无 |
| 双重确认逻辑 | 自研 (不变) | 自研 (不变) | 无 |
| AI Provider | Qwen (DashScope) | Claude (Anthropic API) | 仅配置切换 |
| 上下文合并 | 自研 (不变) | 自研 (不变) | 无 |

### 迁移步骤

```bash
# 1. 修改配置文件
# config/ai-backend.yaml
provider:
  active: claude  # 从 qwen 改为 claude

# 2. 重启服务
npm restart

# 完成！无需修改业务代码
```

---

## 部署方案

### 开发环境

```bash
# 安装依赖
npm install

# 启动 MCP Servers
npm run mcp:start

# 运行 CLI
qwen incident
```

### 生产环境 (Cron 定时运行)

```bash
# crontab -e
*/1 * * * * /path/to/incident/scripts/cron-runner.sh >> /var/log/incident-bot.log 2>&1
```

```bash
#!/bin/bash
# scripts/cron-runner.sh

cd /path/to/incident

# 检查是否有未处理的 Slack 消息
# 如果有，启动 Qwen CLI 处理
node dist/index.js --check-and-run
```

### 生产环境 (常驻进程 - PM2)

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start dist/index.js --name incident-bot

# 开机自启
pm2 save
pm2 startup
```

### 生产环境 (Docker)

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY mcp-servers ./mcp-servers

CMD ["node", "dist/index.js", "--daemon"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  incident-bot:
    build: .
    environment:
      - QWEN_API_KEY=${QWEN_API_KEY}
      - SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

---

## 恢复策略

### CLI 关闭后的恢复

| 情况 | 影响 | 解决方案 |
|------|------|----------|
| 短暂关闭 | 无影响 | 下次 cron 触发继续 |
| 长时间关闭 | 可能错过消息 | 从 Slack 历史读取 |
| 状态丢失 | 内存状态清空 | 从文件恢复 (data/state.json) |

### 状态持久化

```typescript
// 定期保存状态
setInterval(() => {
  fs.writeFileSync(
    './data/state.json',
    JSON.stringify({
      last_pull_ts: state.last_pull_ts,
      processed_message_ids: state.processed_message_ids,
      pending_draft: state.pending_draft,
      local_inputs: state.local_inputs,
    })
  );
}, 10000);

// 启动时恢复
function loadState() {
  try {
    return JSON.parse(
      fs.readFileSync('./data/state.json', 'utf-8')
    );
  } catch {
    return initialState;
  }
}
```

---

## 成功指标

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| 响应时间 | < 60 秒 | 从消息到 AI 回复 |
| 调查准确率 | > 80% | 正确识别根本原因 |
| 误报率 | < 5% | 错误建议次数 |
| 用户满意度 | > 4/5 | 团队反馈 |
| MTTR 降低 | > 30% | 对比引入前后 |

---

## 下一步

1. ✅ **架构设计完成** - MCP Pull 模式 + 双重确认 + 本地交互
2. ✅ **详细文档完成** - `PLAN.md` + `PLAN-MCP-ARCHITECTURE.md`
3. ⬜ **开始 Phase 1** - 项目脚手架 + Slack MCP 配置
4. ⬜ **获取凭证** - Slack App Token, DashScope API Key

---

## 相关文档

| 文档 | 用途 |
|------|------|
| **[PLAN.md](./PLAN.md)** | 主实施计划 - 项目概述、架构、实施阶段、技术栈、配置、部署方案 |
| **[PLAN-MCP-ARCHITECTURE.md](./PLAN-MCP-ARCHITECTURE.md)** | 详细 MCP 架构 - MCP 协议详解、Slack MCP Server 实现、双重确认状态机、本地交互设计 |
| **[QUICK-START.md](./QUICK-START.md)** | 快速恢复指南 - 下次开始的 Prompt、核心设计回顾、快速参考 |

---

*最后更新：2026-03-19*

