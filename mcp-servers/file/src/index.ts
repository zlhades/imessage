/**
 * File MCP Server - 基于文件的消息队列
 *
 * 用于模拟 Slack 消息队列，支持：
 * - 从文件读取消息（模拟拉取 Slack 消息）
 * - 写入消息到文件（模拟发送到 Slack）
 * - 检查新消息（模拟 Slack 新消息检查）
 *
 * 使用场景：
 * - 本地开发和测试
 * - 无 Slack 环境下的 E2E 测试
 * - 演示和原型验证
 *
 * 文件格式：
 * 每行一条消息，JSON 格式：
 * {"ts": "1234567890", "user": "user123", "text": "消息内容", "thread_ts": "可选"}
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';

// 配置文件路径
const DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_FILE = path.join(DATA_DIR, 'messages.jsonl');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化文件
function ensureFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf-8');
  }
}

// 读取文件中的所有消息
function readMessages(filePath: string): any[] {
  ensureFile(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter((line) => line.trim());
  return lines.map((line) => JSON.parse(line));
}

// 追加消息到文件
function appendMessage(filePath: string, message: any) {
  ensureFile(filePath);
  const line = JSON.stringify(message) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

// 定义可用工具
const tools = [
  {
    name: 'file_get_messages',
    description: '从文件读取消息（模拟 Slack get_messages）',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: '消息文件路径（默认：data/messages.jsonl）',
        },
        limit: {
          type: 'number',
          default: 50,
          description: '最多读取的消息数量',
        },
        oldest: {
          type: 'string',
          description: '只读取此时间戳之后的消息',
        },
      },
      required: [],
    },
  },
  {
    name: 'file_send_message',
    description: '写入消息到文件（模拟 Slack send_message）',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: '消息文件路径（默认：data/messages.jsonl）',
        },
        text: {
          type: 'string',
          description: '要发送的消息内容',
        },
        thread_ts: {
          type: 'string',
          description: '线程时间戳（如果是回复）',
        },
        user: {
          type: 'string',
          default: 'bot',
          description: '发送者用户 ID',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'file_check_new_messages',
    description: '检查自某个时间戳以来的新消息（模拟 Slack check_new_messages）',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: '消息文件路径（默认：data/messages.jsonl）',
        },
        since_ts: {
          type: 'string',
          description: '检查此时间戳之后的新消息',
        },
      },
      required: ['since_ts'],
    },
  },
  {
    name: 'file_clear_messages',
    description: '清空消息文件（用于测试重置）',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          description: '消息文件路径（默认：data/messages.jsonl）',
        },
      },
      required: [],
    },
  },
];

// 创建 MCP Server
const server = new Server(
  {
    name: 'file-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[File MCP] Calling tool: ${name}`, args);

  try {
    switch (name) {
      case 'file_get_messages': {
        return await handleGetMessages(args as any);
      }
      case 'file_send_message': {
        return await handleSendMessage(args as any);
      }
      case 'file_check_new_messages': {
        return await handleCheckNewMessages(args as any);
      }
      case 'file_clear_messages': {
        return await handleClearMessages(args as any);
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[File MCP] Error calling ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
          isError: true,
        },
      ],
    };
  }
});

/**
 * Tool: file_get_messages
 * 从文件读取消息
 */
async function handleGetMessages(args: {
  file?: string;
  limit?: number;
  oldest?: string;
}): Promise<any> {
  const filePath = args.file || DEFAULT_FILE;
  const allMessages = readMessages(filePath);

  // 过滤旧消息
  let messages = allMessages;
  if (args.oldest) {
    messages = allMessages.filter((m) => m.ts > args.oldest!);
  }

  // 限制数量
  if (args.limit) {
    messages = messages.slice(0, args.limit);
  }

  console.error(`[File MCP] Read ${messages.length} messages from ${filePath}`);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(messages, null, 2),
      },
    ],
  };
}

/**
 * Tool: file_send_message
 * 写入消息到文件
 */
async function handleSendMessage(args: {
  file?: string;
  text: string;
  thread_ts?: string;
  user?: string;
}): Promise<any> {
  const filePath = args.file || DEFAULT_FILE;
  const ts = String(Date.now() / 1000);

  const message = {
    ts,
    user: args.user || 'bot',
    text: args.text,
    thread_ts: args.thread_ts,
  };

  appendMessage(filePath, message);

  console.error(
    `[File MCP] Message written to ${filePath}: ${args.text.substring(0, 50)}...`
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ok: true,
            ts,
            channel: filePath,
          },
          null, 2
        ),
      },
    ],
  };
}

/**
 * Tool: file_check_new_messages
 * 检查新消息
 */
async function handleCheckNewMessages(args: {
  file?: string;
  since_ts: string;
}): Promise<any> {
  const filePath = args.file || DEFAULT_FILE;
  const allMessages = readMessages(filePath);

  // 过滤新消息
  const newMessages = allMessages.filter((m) => m.ts > args.since_ts);

  console.error(
    `[File MCP] Found ${newMessages.length} new messages since ${args.since_ts}`
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            hasNewMessages: newMessages.length > 0,
            count: newMessages.length,
            messages: newMessages,
          },
          null, 2
        ),
      },
    ],
  };
}

/**
 * Tool: file_clear_messages
 * 清空消息文件
 */
async function handleClearMessages(args: { file?: string }): Promise<any> {
  const filePath = args.file || DEFAULT_FILE;
  
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf-8');
    console.error(`[File MCP] Cleared messages from ${filePath}`);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ ok: true, cleared: true }),
      },
    ],
  };
}

// 启动服务器
async function main() {
  console.error('[File MCP] Starting server...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[File MCP] Server started successfully');
}

main().catch((error) => {
  console.error('[File MCP] Fatal error:', error);
  process.exit(1);
});
