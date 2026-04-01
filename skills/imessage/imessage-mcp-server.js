#!/usr/bin/env node
/**
 * iMessage MCP Server
 * 
 * 让 Qwen Code 可以直接读取并执行 iMessage 指令
 * 
 * 工具列表：
 * - imessage_read: 读取最新消息
 * - imessage_execute: 读取并执行
 * - imessage_search: 搜索消息
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawnSync } from 'child_process';

// 配置
const CONTACTS = ['zlhades@icloud.com', 'zlhades@hotmail.com'];
const IMESSAGE_SCRIPT = '/Users/benson/Documents/incident/skills/imessage/imessage-mcp-server.py';

// 工具定义
const TOOLS = [
  {
    name: 'imessage_read',
    description: '读取指定联系人的最后一条 iMessage 消息',
    inputSchema: {
      type: 'object',
      properties: {
        contact: {
          type: 'string',
          description: '联系人邮箱或电话，如 zlhades@icloud.com'
        }
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
        contact: {
          type: 'string',
          description: '联系人邮箱或电话'
        }
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
        contact: {
          type: 'string',
          description: '联系人邮箱或电话'
        },
        limit: {
          type: 'number',
          description: '返回消息数量',
          default: 5
        }
      },
      required: ['contact']
    }
  },
  {
    name: 'imessage_auto',
    description: '自动模式：读取所有监听联系人的最新消息并执行',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// 执行 Python 脚本
function runPythonScript(args) {
  const result = spawnSync('python3', [IMESSAGE_SCRIPT, ...args], {
    encoding: 'utf-8',
    timeout: 30000
  });
  
  if (result.error) {
    throw result.error;
  }
  
  if (result.status !== 0) {
    throw new Error(result.stderr || '脚本执行失败');
  }
  
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { text: result.stdout };
  }
}

// 创建服务器
const server = new Server(
  {
    name: 'imessage-server',
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
  return { tools: TOOLS };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'imessage_read': {
        const contact = args?.contact || CONTACTS[0];
        const result = runPythonScript(['read', contact]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case 'imessage_execute': {
        const contact = args?.contact || CONTACTS[0];
        const result = runPythonScript(['execute', contact]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case 'imessage_search': {
        const contact = args?.contact || CONTACTS[0];
        const limit = args?.limit || 5;
        const result = runPythonScript(['search', contact, limit.toString()]);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }
      
      case 'imessage_auto': {
        // 自动读取所有联系人的最新消息
        const results = [];
        for (const contact of CONTACTS) {
          try {
            const result = runPythonScript(['read', contact]);
            results.push({ contact, ...result });
          } catch (e) {
            results.push({ contact, error: e.message });
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }
      
      default:
        throw new Error(`未知工具：${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `错误：${error.message}`
        }
      ],
      isError: true
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('iMessage MCP Server 已启动');
}

main().catch((error) => {
  console.error('服务器错误:', error);
  process.exit(1);
});
