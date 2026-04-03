#!/usr/bin/env node
/**
 * msg2cli - MCP Server for Claude Desktop
 *
 * 工具列表：
 * - msg_read: Read the last message from a contact
 * - msg_execute: Read message and analyze executable instructions
 * - msg_search: Search messages from a contact
 * - msg_auto: Read last message from all monitored contacts
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

const TOOLS = [
  { name: 'msg_read', description: 'Read the last iMessage from a contact', inputSchema: { type: 'object', properties: { contact: { type: 'string' } }, required: ['contact'] } },
  { name: 'msg_execute', description: 'Read an iMessage and analyze executable instructions', inputSchema: { type: 'object', properties: { contact: { type: 'string' } }, required: ['contact'] } },
  { name: 'msg_search', description: 'Search recent messages from a contact', inputSchema: { type: 'object', properties: { contact: { type: 'string' }, limit: { type: 'number', default: 5 } }, required: ['contact'] } },
  { name: 'msg_auto', description: 'Auto mode: read last message from all monitored contacts', inputSchema: { type: 'object', properties: {} } }
];

function runPython(method, contact, limit) {
  const script = `
import sys, os, json
sys.path.insert(0, '${join(PROJECT_ROOT, 'src')}')
from input.imessage import IMessageInput
inp = IMessageInput({"contacts": ${JSON.stringify(CONTACTS)}, "db_path": os.path.expanduser("~/Library/Messages/chat.db")})
if method == "last":
    msg = inp.get_last_message()
    print(json.dumps(msg, default=str, ensure_ascii=False) if msg else json.dumps({"error": "No messages"}))
elif method == "search":
    msgs = inp.search_messages("${contact}", ${limit || 5})
    print(json.dumps([{"id": m.id, "text": m.text, "sender": m.sender, "is_from_me": m.is_from_me} for m in msgs], ensure_ascii=False))
`;
  const result = spawnSync('python3', ['-c', script], { encoding: 'utf-8', timeout: 30000 });
  if (result.error) throw result.error;
  try { return JSON.parse(result.stdout); } catch { return { text: result.stdout }; }
}

const server = new Server({ name: 'msg2cli-claude', version: '3.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const contact = args?.contact || CONTACTS[0];
    let result;
    switch (name) {
      case 'msg_read': result = runPython('last', contact); break;
      case 'msg_execute': result = runPython('last', contact); break;
      case 'msg_search': result = runPython('search', contact, args?.limit || 5); break;
      case 'msg_auto': result = CONTACTS.map(c => { try { return { contact: c, ...runPython('last', c) }; } catch(e) { return { contact: c, error: e.message }; } }); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('msg2cli MCP Server (Claude) started');
}
main().catch((error) => { console.error('Server error:', error); process.exit(1); });
