#!/usr/bin/env node
/**
 * msg2cli - MCP Server for Qwen Code
 *
 * 工具列表：
 * - msg_read: 读取联系人的最后一条消息
 * - msg_execute: 读取消息并分析可执行指令
 * - msg_search: 搜索联系人的消息
 * - msg_auto: 读取所有监听联系人的最新消息
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);

const CONTACTS = ['zlhades@icloud.com', 'zlhades@hotmail.com'];
const DB_SCRIPT = join(PROJECT_ROOT, 'src', 'input', 'imessage.py');

const TOOLS = [
  { name: 'msg_read', description: '读取指定联系人的最后一条消息', inputSchema: { type: 'object', properties: { contact: { type: 'string' } }, required: ['contact'] } },
  { name: 'msg_execute', description: '读取消息并分析可执行指令', inputSchema: { type: 'object', properties: { contact: { type: 'string' } }, required: ['contact'] } },
  { name: 'msg_search', description: '搜索联系人的消息', inputSchema: { type: 'object', properties: { contact: { type: 'string' }, limit: { type: 'number', default: 5 } }, required: ['contact'] } },
  { name: 'msg_auto', description: '读取所有监听联系人的最新消息', inputSchema: { type: 'object', properties: {} } }
];

function runPython(args) {
  const result = spawnSync('python3', ['-c', `
import sys, os, json
sys.path.insert(0, '${join(PROJECT_ROOT, 'src')}')
from input.imessage import IMessageInput
config = json.loads('${JSON.stringify({contacts: CONTACTS, db_path: os.path.expanduser("~/Library/Messages/chat.db")}).replace(/'/g, "\\'")}')
inp = IMessageInput(config)
result = getattr(inp, args[0])(*args[1:]) if hasattr(inp, args[0]) else None
print(json.dumps(result, default=str, ensure_ascii=False))
`, ...args], { encoding: 'utf-8', timeout: 30000 });
  if (result.error) throw result.error;
  try { return JSON.parse(result.stdout); } catch { return { text: result.stdout }; }
}

const server = new Server({ name: 'msg2cli-qwen', version: '3.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const contact = args?.contact || CONTACTS[0];
    let result;
    switch (name) {
      case 'msg_read': result = runPython(['get_last_message']); break;
      case 'msg_execute': result = runPython(['get_last_message']); break;
      case 'msg_search': result = runPython(['search_messages', contact, (args?.limit || 5).toString()]); break;
      case 'msg_auto': result = CONTACTS.map(c => { try { return { contact: c, ...runPython(['get_last_message']) }; } catch(e) { return { contact: c, error: e.message }; } }); break;
      default: throw new Error(`未知工具：${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `错误：${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('msg2cli MCP Server (Qwen) 已启动');
}
main().catch((error) => { console.error('服务器错误:', error); process.exit(1); });
