#!/usr/bin/env node
/**
 * msg2cli - MCP Server for Qwen Code
 *
 * Tools:
 * - msg_read:     Read the last message from a contact
 * - msg_search:   Search messages from a contact
 * - msg_auto:     Read latest messages from all monitored contacts
 * - msg_execute:  Read latest message + analyze for executable instructions
 * - msg_status:   Get msg2cli runtime status (logs/stats/config)
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
    description: 'Read the last message from a contact',
    inputSchema: {
      type: 'object',
      properties: { contact: { type: 'string', description: 'Contact email/phone' } },
      required: ['contact']
    }
  },
  {
    name: 'msg_search',
    description: 'Search message history from a contact',
    inputSchema: {
      type: 'object',
      properties: {
        contact: { type: 'string', description: 'Contact email/phone' },
        limit: { type: 'number', default: 5, description: 'Number of results' }
      },
      required: ['contact']
    }
  },
  {
    name: 'msg_auto',
    description: 'Read latest messages from all monitored contacts',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'msg_execute',
    description: 'Read latest message and analyze for executable instructions (run/create/execute etc.)',
    inputSchema: {
      type: 'object',
      properties: { contact: { type: 'string', description: 'Contact email/phone' } },
      required: ['contact']
    }
  },
  {
    name: 'msg_status',
    description: 'Get msg2cli runtime status (log tail, stats, config)',
    inputSchema: { type: 'object', properties: {} }
  }
];

/**
 * Run Python code to read iMessage.
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
  if (result.status !== 0) throw new Error(result.stderr?.trim() || 'Python execution failed');

  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return { text: result.stdout.trim() };
  }
}

/**
 * Analyze whether a message contains executable instructions.
 */
function analyzeInstruction(text) {
  if (!text) return { has_instruction: false, type: 'none', confidence: 0 };

  const patterns = [
    { type: 'shell_command', regex: /(run|execute)\s+(.+)/i },
    { type: 'file_create', regex: /create file\s+(.+)/i },
    { type: 'search', regex: /(search|find|lookup)\s+(.+)/i },
  ];

  for (const { type, regex } of patterns) {
    const match = text.match(regex);
    if (match) {
      return {
        has_instruction: true,
        type,
        extracted: match[2]?.trim() || match[1]?.trim() || text,
        confidence: type === 'shell_command' ? 0.9 : type === 'file_create' ? 0.85 : 0.6,
      };
    }
  }

  return { has_instruction: false, type: 'none', confidence: 0 };
}

/**
 * Get msg2cli runtime status.
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
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ message: msg, analysis }, null, 2)
          }]
        };
      }

      case 'msg_status': {
        return { content: [{ type: 'text', text: JSON.stringify(getStatus(), null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('msg2cli MCP Server (Qwen) v3.0.0 started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
