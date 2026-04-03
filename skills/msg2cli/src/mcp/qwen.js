#!/usr/bin/env node
/**
 * msg2cli - MCP Server for Qwen Code
 *
 * 工具列表：
 * - msg_read:     读取联系人的最后一条消息
 * - msg_search:   搜索联系人的消息
 * - msg_auto:     读取所有监听联系人的最新消息
 * - msg_execute:  读取最新消息 + 分析是否包含可执行指令
 * - msg_status:   获取 msg2cli 运行状态
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

const CONTACTS = ['zlhades@icloud.com', 'zlhades@hotmail.com'];

const TOOLS = [
  {
    name: 'msg_read',
    description: '读取指定联系人的最后一条消息',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: '联系人邮箱/电话' }
      },
      required: ['contact']
    }
  },
  {
    name: 'msg_search',
    description: '搜索联系人的消息历史记录',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: '联系人邮箱/电话' },
        limit: { type: 'number', default: 5, description: '返回条数' }
      },
      required: ['contact']
    }
  },
  {
    name: 'msg_auto',
    description: '读取所有监听联系人的最新消息',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'msg_execute',
    description: '读取最新消息并分析是否包含可执行指令（运行/创建/执行等）',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: '联系人邮箱/电话' }
      },
      required: ['contact']
    }
  },
  {
    name: 'msg_status',
    description: '获取 msg2cli 运行状态（日志/统计/配置）',
    inputSchema: { type: 'object', properties: {} }
  }
];

/**
 * 运行 Python 代码读取 iMessage
 */
function runPython(method, args = []) {
  const config = JSON.stringify({
    contacts: CONTACTS,
    db_path: process.env.HOME + '/Library/Messages/chat.db'
  });

  const pythonCode = `
import sys, os, json
sys.path.insert(0, '${join(PROJECT_ROOT, 'src')}')
from input.imessage import IMessageInput
config = json.loads('${config}')
inp = IMessageInput(config)
result = getattr(inp, '${method}')(*${JSON.stringify(args)})
print(json.dumps(result, default=str, ensure_ascii=False))
`;

  const result = spawnSync('python3', ['-c', pythonCode], {
    encoding: 'utf-8',
    timeout: 30000
  });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr?.trim() || 'Python 执行失败');

  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return { text: result.stdout.trim() };
  }
}

/**
 * 分析消息中是否包含可执行指令
 */
function analyzeInstruction(text) {
  if (!text) return { has_instruction: false, type: 'none', confidence: 0 };

  const patterns = [
    { type: 'shell_command', patterns: [/运行\s*(.+)/, /执行\s*(.+)/, /run\s+(.+)/i, /execute\s+(.+)/i] },
    { type: 'file_create', patterns: [/创建文件\s*(.+)/, /create file\s+(.+)/i, /新建文件\s*(.+)/] },
    { type: 'search', patterns: [/搜索\s*(.+)/, /查找\s*(.+)/, /search\s+(.+)/i, /find\s+(.+)/i] },
    { type: 'general', patterns: [/帮我?\s*(.+)/, /请\s*(.+)/] },
  ];

  for (const { type, patterns: pats } of patterns) {
    for (const pat of pats) {
      const match = text.match(pat);
      if (match) {
        return {
          has_instruction: true,
          type,
          extracted: match[1]?.trim() || text,
          confidence: type === 'shell_command' ? 0.9 : type === 'file_create' ? 0.85 : 0.6,
        };
      }
    }
  }

  return { has_instruction: false, type: 'none', confidence: 0 };
}

/**
 * 获取 msg2cli 状态
 */
function getStatus() {
  const logFile = '/tmp/msg2cli.log';
  const doneFile = '/tmp/msg2cli_done.txt';

  let logTail = '';
  if (fs.existsSync(logFile)) {
    const logs = fs.readFileSync(logFile, 'utf-8').trim().split('\n');
    logTail = logs.slice(-10).join('\n');
  }

  let doneCount = 0;
  if (fs.existsSync(doneFile)) {
    doneCount = fs.readFileSync(doneFile, 'utf-8').trim().split('\n').filter(Boolean).length;
  }

  return {
    log_file: logFile,
    log_tail: logTail,
    processed_messages: doneCount,
    contacts: CONTACTS,
    config_path: join(PROJECT_ROOT, 'config', 'config.yaml'),
  };
}

// ============== MCP Server ==============

const server = new Server(
  { name: 'msg2cli-qwen', version: '3.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const contact = args?.contact || CONTACTS[0];

    switch (name) {
      case 'msg_read': {
        const result = runPython('get_last_message');
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'msg_search': {
        const limit = args?.limit || 5;
        const result = runPython('search_messages', [contact, limit]);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'msg_auto': {
        const results = CONTACTS.map(c => {
          try {
            const msg = runPython('get_last_message');
            return { contact: c, ...msg };
          } catch (e) {
            return { contact: c, error: e.message };
          }
        });
        return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
      }

      case 'msg_execute': {
        const msg = runPython('get_last_message');
        const analysis = analyzeInstruction(msg?.text || '');
        const result = {
          message: msg,
          analysis,
          recommendation: analysis.has_instruction
            ? `检测到 ${analysis.type} 类型指令，可以注入到 AI CLI 执行`
            : '未检测到明确指令，建议人工判断'
        };
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'msg_status': {
        const status = getStatus();
        return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
      }

      default:
        throw new Error(`未知工具：${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `错误：${error.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('msg2cli MCP Server (Qwen) v3.0.0 已启动');
}

main().catch((error) => {
  console.error('服务器错误:', error);
  process.exit(1);
});
