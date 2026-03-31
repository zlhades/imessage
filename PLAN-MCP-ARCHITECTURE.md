# MCP 架构深入研究

## 1. MCP (Model Context Protocol) 协议详解

### 1.1 MCP 核心概念

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP 架构组件                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐ │
│  │    Client    │◄───────►│    Server    │◄───────►│   External   │ │
│  │  (AI Model)  │  JSON   │  (MCP Server) │  API   │   Services   │ │
│  │              │  RPC    │              │        │  (Slack, etc)│ │
│  └──────────────┘         └──────────────┘         └──────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### MCP 通信协议

```typescript
// MCP 使用 JSON-RPC 2.0 进行通信
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "slack_get_messages",
    "arguments": {
      "channel": "#incidents",
      "limit": 50,
      "oldest": "1710828000"
    }
  }
}

// 响应
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"ts\":\"1710828100\",\"user\":\"U123\",\"text\":\"服务挂了！\"}]"
      }
    ]
  }
}
```

### MCP 核心能力

| 能力 | 描述 | 本例用途 |
|------|------|----------|
| **Tools** | 可调用的外部工具 | Slack 消息、GitHub 查询、Metrics |
| **Resources** | 可读取的数据源 | Slack 频道列表、历史消息 |
| **Prompts** | 预定义的提示模板 | Incident 响应模板、追问模板 |

---

## 2. Slack MCP Server 设计

### 2.1 现有 Slack MCP Server 调研

目前开源社区有以下 Slack MCP Server：

| 项目 | 状态 | 功能 |
|------|------|------|
| modelcontextprotocol/server-slack | 官方示例 | 基础消息读写 |
| slack-mcp-server (community) | 活跃 | 频道管理、消息、线程 |
| 自定义 Server | 推荐 | 按需实现 Incident 特定功能 |

### 2.2 推荐：自定义 Slack MCP Server

**原因**:
- Incident 响应需要特定功能（如：发送前检查、线程管理）
- 可以深度集成双重确认机制
- 便于未来迁移到 Claude Code（MCP 是标准协议）

### 2.3 Slack MCP Server 接口设计

```typescript
// mcp-server-slack/src/index.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebClient } from '@slack/web-api';

// MCP Server 定义
const server = new Server({
  name: 'slack-incident-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {
      slack_get_messages: {
        description: '从 Slack 频道拉取消息',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: '频道名或 ID，如 #incidents' },
            limit: { type: 'number', default: 50, description: '消息数量' },
            oldest: { type: 'string', description: '最早时间戳 (Unix timestamp)' },
            latest: { type: 'string', description: '最晚时间戳 (Unix timestamp)' },
          },
          required: ['channel'],
        },
      },
      slack_send_message: {
        description: '发送消息到 Slack 频道',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: '频道名或 ID' },
            text: { type: 'string', description: '消息内容' },
            thread_ts: { type: 'string', description: '线程时间戳 (回复到线程)' },
            skip_confirmation: { type: 'boolean', default: false, description: '跳过二次确认检查' },
          },
          required: ['channel', 'text'],
        },
      },
      slack_check_new_messages: {
        description: '检查指定时间后是否有新消息 (用于发送前二次确认)',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: '频道名或 ID' },
            since_ts: { type: 'string', description: '检查此时间戳之后的消息' },
            thread_ts: { type: 'string', description: '线程时间戳 (可选)' },
          },
          required: ['channel', 'since_ts'],
        },
      },
      slack_get_thread_replies: {
        description: '获取线程回复',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: '频道名或 ID' },
            thread_ts: { type: 'string', description: '线程时间戳' },
          },
          required: ['channel', 'thread_ts'],
        },
      },
    },
  },
});

// 工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'slack_get_messages': {
      const result = await webClient.conversations.history({
        channel: args.channel,
        limit: args.limit,
        oldest: args.oldest,
        latest: args.latest,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result.messages) }],
      };
    }
    
    case 'slack_send_message': {
      const result = await webClient.chat.postMessage({
        channel: args.channel,
        text: args.text,
        thread_ts: args.thread_ts,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    }
    
    case 'slack_check_new_messages': {
      const result = await webClient.conversations.history({
        channel: args.channel,
        oldest: args.since_ts,
        limit: 100,
      });
      // 过滤掉自己发的消息
      const newMessages = result.messages.filter(
        m => m.ts > args.since_ts && m.user !== process.env.SLACK_BOT_USER_ID
      );
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            hasNewMessages: newMessages.length > 0,
            count: newMessages.length,
            messages: newMessages,
          }) 
        }],
      };
    }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

---

## 3. 发送前双重确认机制详细设计

### 3.1 状态机设计

```
┌─────────────────────────────────────────────────────────────────────┐
│                    发送前双重确认状态机                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐    生成回复   ┌─────────────┐                      │
│  │  ANALYZING  │──────────────►│  PREPARING  │                      │
│  │  (分析中)   │               │  (准备中)   │                      │
│  └─────────────┘               └──────┬──────┘                      │
│                                       │                              │
│                                       │ Pull #1                      │
│                                       ▼                              │
│                              ┌─────────────┐                         │
│                              │  PULLED_1   │                         │
│                              │ (第一次拉取) │                         │
│                              └──────┬──────┘                         │
│                                     │                                │
│                                     │ 生成草稿                        │
│                                     ▼                                │
│                              ┌─────────────┐                         │
│                              │  WAITING_   │                         │
│                              │  CONFIRM    │                         │
│                              │ (等待确认)  │                         │
│                              └──────┬──────┘                         │
│                                     │                                │
│           ┌─────────────────────────┼─────────────────────────┐      │
│           │                         │                         │      │
│           │  用户 Confirm           │  用户 Modify/补充       │      │
│           ▼                         ▼                         │      │
│  ┌─────────────┐           ┌─────────────┐                    │      │
│  │  PULL_2     │           │  REGENERATE │                    │      │
│  │ (第二次拉取)│           │  (重新生成) │                    │      │
│  └──────┬──────┘           └─────────────┘                    │      │
│         │                      ▲                               │      │
│         │ 检查新消息           │                               │      │
│         ▼                      │                               │      │
│  ┌─────────────┐               │                               │      │
│  │  CHECK_     │───────────────┘                               │      │
│  │  RESULT     │ 有新消息？                                     │      │
│  └──────┬──────┘                                               │      │
│         │                                                       │      │
│    ┌────┴────┐                                                  │      │
│    │         │                                                 │      │
│    ▼         ▼                                                  │      │
│ YES │       │ NO                                                │      │
│    │         │                                                  │      │
│    ▼         ▼                                                  │      │
│ ┌──────┐  ┌──────────┐                                          │      │
│ │RE-   │  │  SEND    │                                          │      │
│ │ANALYZE│  │ (发送)   │                                          │      │
│ └──────┘  └──────────┘                                          │      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 实现代码

```typescript
// src/approval/gateway.ts

interface ApprovalState {
  draft: {
    channel: string;
    text: string;
    thread_ts?: string;
    generated_at: number;
    pull_ts: string;  // 第一次 Pull 的时间戳
  };
  local_input?: {
    text: string;
    timestamp: number;
  };
  status: 'WAITING_CONFIRM' | 'PULL_2_PENDING' | 'SENDING' | 'REANALYZING';
}

class ApprovalGateway {
  private state?: ApprovalState;
  
  /**
   * 步骤 1: 生成回复草稿，等待用户确认
   */
  async prepareResponse(params: {
    channel: string;
    text: string;
    thread_ts?: string;
    pull_ts: string;
  }): Promise<{ status: 'WAITING_CONFIRM'; draft: ApprovalState['draft'] }> {
    this.state = {
      draft: {
        ...params,
        generated_at: Date.now(),
      },
      status: 'WAITING_CONFIRM',
    };
    
    // 显示草稿给用户
    this.showDraft(this.state.draft);
    
    return {
      status: 'WAITING_CONFIRM',
      draft: this.state.draft,
    };
  }
  
  /**
   * 步骤 2a: 用户确认，进入第二次 Pull
   */
  async confirm(): Promise<{
    status: 'PULL_2_PENDING' | 'REANALYZING';
    newMessages?: SlackMessage[];
  }> {
    if (!this.state || this.state.status !== 'WAITING_CONFIRM') {
      throw new Error('No draft to confirm');
    }
    
    // 第二次 Pull：检查是否有新消息
    const result = await this.callMCP('slack_check_new_messages', {
      channel: this.state.draft.channel,
      since_ts: this.state.draft.pull_ts,
      thread_ts: this.state.draft.thread_ts,
    });
    
    const { hasNewMessages, messages } = JSON.parse(result.content[0].text);
    
    if (hasNewMessages) {
      // 有新消息，需要重新分析
      this.state.status = 'REANALYZING';
      return {
        status: 'REANALYZING',
        newMessages: messages,
      };
    }
    
    // 无新消息，可以发送
    this.state.status = 'PULL_2_PENDING';
    return {
      status: 'PULL_2_PENDING',
    };
  }
  
  /**
   * 步骤 2b: 用户修改或补充信息
   */
  async modify(params: {
    newText?: string;
    additionalInfo?: string;
  }): Promise<{ status: 'REANALYZING'; draft: string }> {
    if (!this.state) {
      throw new Error('No draft to modify');
    }
    
    if (params.additionalInfo) {
      // 用户补充本地信息
      this.state.local_input = {
        text: params.additionalInfo,
        timestamp: Date.now(),
      };
    }
    
    if (params.newText) {
      // 用户直接修改草稿
      this.state.draft.text = params.newText;
    }
    
    this.state.status = 'REANALYZING';
    
    return {
      status: 'REANALYZING',
      draft: this.state.draft.text,
    };
  }
  
  /**
   * 步骤 3: 发送消息
   */
  async send(): Promise<{ success: boolean; ts: string }> {
    if (!this.state || this.state.status !== 'PULL_2_PENDING') {
      throw new Error('Not ready to send. Please confirm first.');
    }
    
    const result = await this.callMCP('slack_send_message', {
      channel: this.state.draft.channel,
      text: this.state.draft.text,
      thread_ts: this.state.draft.thread_ts,
    });
    
    const response = JSON.parse(result.content[0].text);
    
    // 清除状态
    this.state = undefined;
    
    return {
      success: response.ok,
      ts: response.ts,
    };
  }
  
  /**
   * 显示草稿到本地终端
   */
  private showDraft(draft: ApprovalState['draft']) {
    console.log('\n' + '='.repeat(60));
    console.log('📤 准备发送以下回复到 Slack:');
    console.log('='.repeat(60));
    console.log(`频道：${draft.channel}`);
    console.log('-'.repeat(60));
    console.log(draft.text);
    console.log('-'.repeat(60));
    console.log('\n请选择操作:');
    console.log('  [1] ✓ 确认发送');
    console.log('  [2] ✏️ 修改草稿');
    console.log('  [3] 🔍 进一步调查');
    console.log('  [4] 💬 补充本地信息');
    console.log('  [5] ❌ 取消');
    console.log('='.repeat(60) + '\n');
  }
  
  /**
   * 调用 MCP 工具
   */
  private async callMCP(toolName: string, args: Record<string, any>) {
    // 通过 stdio 调用 MCP Server
    // 实际实现会使用 @modelcontextprotocol/sdk 的 Client
    return mcpClient.callTool(toolName, args);
  }
}
```

---

## 4. 本地交互设计详细

### 4.1 CLI 交互界面

```typescript
// src/cli/interactive.ts

import * as readline from 'readline';

class InteractiveCLI {
  private rl: readline.Interface;
  private currentAction?: 'CONFIRM' | 'MODIFY' | 'INVESTIGATE' | 'SUPPLEMENT';
  
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  
  /**
   * 主循环：等待用户输入
   */
  async prompt(options: {
    context: string;  // 当前上下文（Slack 消息摘要）
    draft?: string;   // 待确认的草稿
    actions: Array<{
      key: string;
      label: string;
      handler: () => Promise<void>;
    }>;
  }): Promise<string> {
    return new Promise((resolve) => {
      console.log(options.context);
      
      if (options.draft) {
        console.log('\n草稿:');
        console.log(options.draft);
      }
      
      console.log('\n操作:');
      options.actions.forEach(a => {
        console.log(`  [${a.key}] ${a.label}`);
      });
      
      this.rl.question('> ', (input) => {
        const action = options.actions.find(a => a.key === input);
        if (action) {
          action.handler().then(() => resolve(input));
        } else {
          // 用户直接输入内容（补充信息）
          resolve(input);
        }
      });
    });
  }
  
  /**
   * 获取用户补充的信息
   */
  async getSupplement(): Promise<string> {
    return new Promise((resolve) => {
      console.log('\n请输入补充信息 (输入 END 结束):');
      
      const lines: string[] = [];
      
      this.rl.on('line', (line) => {
        if (line === 'END') {
          this.rl.removeAllListeners('line');
          resolve(lines.join('\n'));
        } else {
          lines.push(line);
        }
      });
    });
  }
  
  close() {
    this.rl.close();
  }
}
```

### 4.2 本地 + Slack 消息合并

```typescript
// src/conversation/merge.ts

interface MergedContext {
  slack_messages: SlackMessage[];
  local_inputs: LocalInput[];
  timeline: TimelineEvent[];
}

interface LocalInput {
  text: string;
  timestamp: number;
  type: 'SUPPLEMENT' | 'INSTRUCTION' | 'CORRECTION';
}

interface TimelineEvent {
  ts: string;
  type: 'SLACK_MESSAGE' | 'LOCAL_INPUT' | 'AI_ACTION';
  content: string;
  user?: string;  // Slack 用户 ID
  source: 'SLACK' | 'LOCAL';
}

/**
 * 合并 Slack 消息和本地输入，生成统一上下文
 */
function mergeContext(
  slackMessages: SlackMessage[],
  localInputs: LocalInput[]
): MergedContext {
  const timeline: TimelineEvent[] = [];
  
  // 添加 Slack 消息
  slackMessages.forEach(msg => {
    timeline.push({
      ts: msg.ts,
      type: 'SLACK_MESSAGE',
      content: msg.text,
      user: msg.user,
      source: 'SLACK',
    });
  });
  
  // 添加本地输入
  localInputs.forEach(input => {
    timeline.push({
      ts: String(input.timestamp),
      type: 'LOCAL_INPUT',
      content: input.text,
      source: 'LOCAL',
    });
  });
  
  // 按时间排序
  timeline.sort((a, b) => Number(a.ts) - Number(b.ts));
  
  return {
    slack_messages: slackMessages,
    local_inputs: localInputs,
    timeline,
  };
}

/**
 * 生成 AI 提示词
 */
function generatePrompt(mergedContext: MergedContext): string {
  const { timeline } = mergedContext;
  
  let prompt = '你是 Incident 响应助手。以下是事件时间线：\n\n';
  
  timeline.forEach(event => {
    const source = event.source === 'SLACK' ? 'Slack' : '本地';
    const user = event.user ? `@${event.user}` : '[本地用户]';
    
    prompt += `[${new Date(Number(event.ts) * 1000).toLocaleTimeString()}] `;
    prompt += `(${source}) ${user}: ${event.content}\n`;
  });
  
  prompt += '\n请分析当前情况，决定下一步行动。';
  
  return prompt;
}
```

---

## 5. 完整数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                        完整数据流                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. 定时触发 (cron 每 30 秒)                                          │
│         │                                                           │
│         ▼                                                           │
│  2. Slack MCP: get_messages(channel="#incidents", limit=50)         │
│         │                                                           │
│         ▼                                                           │
│  3. 合并本地输入 (如有)                                              │
│         │                                                           │
│         ▼                                                           │
│  4. AI 分析 (Qwen/Claude)                                           │
│         │                                                           │
│         ├─────────────────┬─────────────────┬──────────────────────┤ │
│         ▼                 ▼                 ▼                      │ │
│   信息不足            需要调查           有结论                    │ │
│         │                 │                 │                       │ │
│         ▼                 ▼                 ▼                       │ │
│   生成追问           调用工具           生成回复草稿               │ │
│   发送到 Slack        (GitHub/Logs)        │                       │ │
│                                            ▼                       │ │
│                                   显示到本地终端                    │ │
│                                            │                       │ │
│                                   用户选择操作                      │ │
│                                            │                       │ │
│              ┌─────────────────────────────┼──────────────────────┤ │
│              │                 │           │                      │ │
│              ▼                 ▼           ▼                      ▼ │
│        [1] 确认发送      [2] 修改    [3] 再调查            [4] 补充  │
│              │                 │           │                      │ │
│              ▼                 │           │                      │ │
│       第二次 Pull              │           │                      │ │
│              │                 │           │                      │ │
│         ┌────┴────┐            │           │                      │ │
│         │         │            │           │                      │ │
│         ▼         ▼            │           │                      │ │
│    有新消息    无新消息        │           │                      │ │
│         │         │            │           │                      │ │
│         ▼         ▼            │           │                      │ │
│    重新分析    发送 Slack ◄────┴───────────┴──────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 项目结构更新

```
incident/
├── src/
│   ├── index.ts                    # 入口 (CLI)
│   ├── cli/
│   │   ├── interactive.ts          # 本地交互界面
│   │   └── commands.ts             # CLI 命令定义
│   ├── mcp/
│   │   ├── client.ts               # MCP Client
│   │   └── slack-server/           # Slack MCP Server
│   │       ├── index.ts
│   │       ├── tools/
│   │       │   ├── get_messages.ts
│   │       │   ├── send_message.ts
│   │       │   └── check_new.ts
│   │       └── config.ts
│   ├── conversation/
│   │   ├── merge.ts                # Slack+ 本地合并
│   │   ├── context.ts              # 上下文管理
│   │   └── timeline.ts             # 时间线生成
│   ├── ai/
│   │   ├── provider.ts             # AI Provider 抽象
│   │   ├── qwen-provider.ts        # Qwen 实现
│   │   └── claude-provider.ts      # Claude 实现 (预留)
│   ├── analysis/
│   │   ├── intent.ts               # 意图识别
│   │   ├── completeness.ts         # 信息完整性检查
│   │   └── decision.ts             # 决策生成
│   ├── investigation/
│   │   ├── engine.ts               # 调查引擎
│   │   ├── github-mcp.ts           # GitHub MCP 调用
│   │   ├── logs-mcp.ts             # Logs MCP 调用
│   │   └── prometheus-mcp.ts       # Prometheus MCP 调用
│   ├── approval/
│   │   └── gateway.ts              # 发送前双重确认
│   └── config/
│       ├── index.ts
│       └── schema.ts
├── mcp-servers/
│   ├── slack/
│   │   ├── package.json
│   │   └── src/
│   ├── github/
│   └── prometheus/
├── config/
│   ├── ai-backend.yaml
│   ├── slack.yaml
│   └── mcp.yaml
├── scripts/
│   ├── cron-runner.sh              # Cron 入口
│   └── setup.sh
├── tests/
├── package.json
├── tsconfig.json
└── README.md
```

---

## 7. 配置文件

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

### config/ai-backend.yaml

```yaml
provider:
  active: qwen
  
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

## 8. 迁移到 Claude Code

### 迁移步骤

```bash
# 1. 修改 AI Provider 配置
# config/ai-backend.yaml
provider:
  active: claude  # 从 qwen 改为 claude

# 2. MCP Servers 不变 (标准协议)
# 3. 业务逻辑不变
# 4. 重启服务

npm restart
```

### 为什么迁移简单？

| 组件 | 是否变化 | 原因 |
|------|----------|------|
| MCP Servers | ❌ 不变 | 标准协议，AI 无关 |
| 本地交互 CLI | ❌ 不变 | 用户界面，AI 无关 |
| 双重确认逻辑 | ❌ 不变 | 业务逻辑，AI 无关 |
| AI Provider | ✅ 变化 | 仅配置切换 |
| 提示词 | ⚠️ 微调 | 不同模型可能有差异 |

---

## 9. 部署方案

### 开发环境

```bash
# 启动 MCP Servers
npm run mcp:start

# 运行 CLI
qwen incident
```

### 生产环境 (Cron)

```bash
# crontab -e
*/1 * * * * /path/to/incident/scripts/cron-runner.sh
```

```bash
#!/bin/bash
# scripts/cron-runner.sh

cd /path/to/incident

# 检查是否有未处理的 Slack 消息
# 如果有，启动 Qwen CLI 处理
node dist/index.js --check-and-run
```

### 生产环境 (常驻进程)

```typescript
// scripts/daemon.ts

import { spawn } from 'child_process';

function runBot() {
  const child = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
  });
  
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error('Bot crashed, restarting...');
      setTimeout(runBot, 5000);  // 5 秒后重启
    }
  });
}

runBot();

// 每 30 秒唤醒一次
setInterval(() => {
  // 触发检查
}, 30000);
```

---

## 10. 错误处理与恢复

### 错误场景

| 场景 | 处理策略 |
|------|----------|
| MCP Server 崩溃 | 自动重启，记录日志 |
| Slack API 失败 | 指数退避重试 |
| AI API 超时 | 切换备用 Provider (如配置) |
| 发送前检查失败 | 取消发送，通知用户 |
| 本地输入丢失 | 定期持久化到文件 |

### 恢复机制

```typescript
// src/state/persistence.ts

interface PersistedState {
  last_pull_ts: string;
  processed_message_ids: string[];
  pending_draft?: ApprovalState['draft'];
  local_inputs: LocalInput[];
}

// 定期保存状态
setInterval(() => {
  fs.writeFileSync(
    './data/state.json',
    JSON.stringify(currentState)
  );
}, 10000);

// 重启时恢复
function loadState(): PersistedState {
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

*最后更新：2026-03-19*
