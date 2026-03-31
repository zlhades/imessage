# Quick Start - 快速恢复指南

## 📚 项目文档说明

| 文档 | 用途 | 何时阅读 |
|------|------|----------|
| **[PLAN.md](./PLAN.md)** | 主实施计划 - 完整的项目概述、架构、实施阶段、技术栈、配置示例、部署方案 | 了解项目全貌、查看实施进度 |
| **[PLAN-MCP-ARCHITECTURE.md](./PLAN-MCP-ARCHITECTURE.md)** | 详细 MCP 架构 - MCP 协议详解、Slack MCP Server 实现代码、双重确认状态机、本地交互设计 | 实现具体模块时参考 |
| **[QUICK-START.md](./QUICK-START.md)** | 快速恢复指南 - 下次开始的 Prompt、核心设计回顾、快速参考 | **下次开始时直接复制 Prompt** |

---

## 🚀 下次开始时使用的 Prompt

**复制下面的内容发送给 AI：**

```
继续实施 Slack AI Incident Response Bot 项目。

📖 项目文档：
- 主计划：./PLAN.md
- 详细架构：./PLAN-MCP-ARCHITECTURE.md

💡 核心设计：
1. MCP Pull 架构 - Qwen Code CLI 通过 MCP 协议拉取 Slack 消息
2. 发送前双重确认 - Pull → Confirm → 再 Pull → 发送
3. 本地交互 - 支持本地补充信息和指导 AI
4. 增量更新 - 默认不取消任务，合并新消息
5. 无缝迁移 - 改配置即可从 Qwen 切换到 Claude

📊 当前进度：
- ✅ 架构设计完成
- ✅ 详细文档完成
- ✅ Phase 1: 基础架构 (已完成)
- ✅ Phase 2: AI 核心 (已完成)
- ✅ Phase 3: 调查引擎 (已完成)
- ✅ Phase 4: 发送前双重确认 (已完成)
- ✅ Phase 5: 定时运行 + 状态持久化 (已完成)
- ✅ Phase 6: 迁移准备 (已完成)

🎉 所有 Phase 已完成！

下一步：
1. 运行 `npm install` 安装依赖
2. 配置 `.env` 文件
3. 运行 `npm run dev` 测试
```

---

## 项目文件结构

```
incident/
├── PLAN.md                      # 主实施计划
├── PLAN-MCP-ARCHITECTURE.md     # 详细 MCP 架构
├── QUICK-START.md               # 本文件 - 快速恢复指南
├── src/                         # 源代码 (待创建)
├── mcp-servers/                 # MCP Servers (待创建)
├── config/                      # 配置文件 (待创建)
└── data/                        # 运行时数据 (gitignore)
```

---

## 核心设计决策回顾

### 1. 架构选择：MCP Pull 模式

| 选项 | 选择 | 理由 |
|------|------|------|
| Slack Bolt (Push) | ❌ | 需要常驻服务，复杂 |
| **MCP Pull** | ✅ | 无状态，简单，定时运行即可 |

### 2. 并发处理：增量更新

| 策略 | 选择 | 理由 |
|------|------|------|
| 取消重来 | ❌ | 浪费资源 |
| **增量更新** | ✅ | 合并新消息，不取消当前任务 |
| 队列等待 | ❌ | 响应慢 |

### 3. 发送前双重确认

```
Pull #1 → 生成草稿 → 用户 Confirm → Pull #2 → 检查新消息 → 发送
                                              ↓
                                        有新消息 → 重新分析
```

### 4. 本地交互

- 支持本地补充 Slack 没有的信息
- 支持指导 AI 进一步调查
- 支持修改/批准回复

### 5. AI Provider 抽象

```typescript
interface AIProvider {
  analyze(context): Promise<AnalysisResult>;
  generateResponse(analysis): Promise<string>;
  generateQuestions(missingInfo): Promise<string[]>;
  decideInvestigation(analysis): Promise<InvestigationPlan>;
}

// 实现:
// - QwenProvider: DashScope API
// - ClaudeProvider: Anthropic API (预留)
```

---

## 技术栈

| 模块 | 选型 |
|------|------|
| 运行时 | Node.js 20+ / TypeScript |
| MCP | @modelcontextprotocol/sdk |
| Slack | @slack/web-api + MCP |
| AI | DashScope SDK (OpenAI 兼容) |
| 配置 | YAML + dotenv |
| 日志 | Winston + JSON |
| 测试 | Jest + Vitest |

---

## 配置示例

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
```

---

## 实施阶段

### Phase 1: 基础架构 (Week 1)
- [ ] 1.1 项目初始化
- [ ] 1.2 Slack MCP Server 配置
- [ ] 1.3 Qwen Code CLI 集成
- [ ] 1.4 本地交互界面
- [ ] 1.5 日志系统

### Phase 2: AI 核心 (Week 2)
- [ ] 2.1 AI Provider 抽象层
- [ ] 2.2 Qwen Provider 实现
- [ ] 2.3 意图识别
- [ ] 2.4 信息完整性检查
- [ ] 2.5 追问逻辑
- [ ] 2.6 Claude Provider 占位

### Phase 3: 调查引擎 (Week 3)
- [ ] 3.1 GitHub MCP 集成
- [ ] 3.2 日志 MCP 集成
- [ ] 3.3 Prometheus MCP 集成
- [ ] 3.4 调查结果汇总

### Phase 4: 发送前双重确认 (Week 4)
- [ ] 4.1 第一次 Pull → 生成草稿
- [ ] 4.2 本地确认界面
- [ ] 4.3 发送前第二次 Pull
- [ ] 4.4 新消息影响判断
- [ ] 4.5 本地信息补充

### Phase 5: 定时运行 + 状态持久化 (Week 5)
- [ ] 5.1 Cron 定时任务
- [ ] 5.2 已处理消息 ID 记录
- [ ] 5.3 本地状态缓存
- [ ] 5.4 失败重试

### Phase 6: 迁移准备 (内置)
- [ ] 6.1 配置支持多 Provider
- [ ] 6.2 Provider Router
- [ ] 6.3 迁移文档

---

## 需要的凭证

开始前请准备：

1. **Slack App Token**
   - 创建 Slack App
   - 启用 Socket Mode
   - 获取 `SLACK_APP_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`

2. **DashScope API Key**
   - 注册阿里云账号
   - 开通 DashScope 服务
   - 获取 `QWEN_API_KEY`

3. **其他 (Phase 3 需要)**
   - GitHub Token
   - Prometheus URL + API Key
   - 日志系统 API

---

## 快速命令

```bash
# 查看计划
cat PLAN.md

# 查看架构详情
cat PLAN-MCP-ARCHITECTURE.md

# 开始实施
qwen  # 然后粘贴上面的 Prompt
```

---

*创建时间：2026-03-19 | 最后更新：2026-03-19*
