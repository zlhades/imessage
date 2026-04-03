#!/usr/bin/env node
/**
 * iMessage MCP Server - Qwen Code
 *
 * 让 Qwen Code 可以直接读取并执行 iMessage 指令
 *
 * 工具列表：
 * - imessage_read: 读取联系人的最后一条消息
 * - imessage_execute: 读取消息并分析可执行指令
 * - imessage_search: 搜索联系人的消息
 * - imessage_auto: 读取所有监听联系人的最新消息
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTACTS = ['zlhades@icloud.com', 'zlhades@hotmail.com'];
const DB_SCRIPT = join(__dirname, 'imessage_db.py');

const TOOLS = [
  {
    name: 'imessage_read',
    description: '读取指定联系人的最后一条 iMessage 消息',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: '联系人邮箱或电话' }
      },
      required: ['contact']
    }
  },
  {
    name: 'imessage_execute',
    description: '读取 iMessage 消息并分析其中的可执行指令',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: '联系人邮箱或电话' }
      },
      required: ['contact']
    }
  },
  {
    name: 'imessage_search',
    description: '搜索联系人的最近消息',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: '联系人邮箱或电话' },
        limit: { type: 'number', description: '返回消息数量', default: 5 }
      },
      required: ['contact']
    }
  },
  {
    name: 'imessage_auto',
    description: '自动模式：读取所有监听联系人的最新消息',
    inputSchema: { type: 'object', properties: {} }
  }
];

function runPython(args) {
  const result = spawnSync('python3', [DB_SCRIPT, ...args], {
    encoding: 'utf-8',
    timeout: 30000
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || '脚本执行失败');
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { text: result.stdout };
  }
}

const server = new Server(
  { name: 'imessage-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'imessage_read': {
        const contact = args?.contact || CONTACTS[0];
        const result = runPython(['last', contact]);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      case 'imessage_execute': {
        const contact = args?.contact || CONTACTS[0];
        const msg = runPython(['last', contact]);
        const analysis = runPython(['analyze', msg.text || '']);
        return { content: [{ type: 'text', text: JSON.stringify({ ...msg, analysis }, null, 2) }] };
      }
      case 'imessage_search': {
        const contact = args?.contact || CONTACTS[0];
        const limit = args?.limit || 5;
        const result = runPython(['search', contact, limit.toString()]);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }
      case 'imessage_auto': {
        const results = CONTACTS.map(contact => {
          try {
            return { contact, ...runPython(['last', contact]) };
          } catch (e) {
            return { contact, error: e.message };
          }
        });
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }
      default:
        throw new Error(`未知工具：${name}`);
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `错误：${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('iMessage MCP Server (Qwen) 已启动');
}

main().catch((error) => {
  console.error('服务器错误:', error);
  process.exit(1);
});
