#!/usr/bin/env node
/**
 * iMessage MCP Server - Claude Desktop
 *
 * 让 Claude Desktop 可以直接读取并执行 iMessage 指令
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
    description: 'Read the last iMessage from a contact',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: 'Contact email or phone, e.g. zlhades@icloud.com' }
      },
      required: ['contact']
    }
  },
  {
    name: 'imessage_execute',
    description: 'Read an iMessage and analyze executable instructions within it',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: 'Contact email or phone' }
      },
      required: ['contact']
    }
  },
  {
    name: 'imessage_search',
    description: 'Search recent messages from a contact',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: 'Contact email or phone' },
        limit: { type: 'number', description: 'Number of messages to return', default: 5 }
      },
      required: ['contact']
    }
  },
  {
    name: 'imessage_auto',
    description: 'Auto mode: read last message from all monitored contacts',
    inputSchema: { type: 'object', properties: {} }
  }
];

function runPython(args) {
  const result = spawnSync('python3', [DB_SCRIPT, ...args], {
    encoding: 'utf-8',
    timeout: 30000
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'Script execution failed');
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
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('iMessage MCP Server (Claude) started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
