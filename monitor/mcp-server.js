#!/usr/bin/env node
/**
 * Incident Monitor MCP Server
 * 
 * 在 AI 内部运行的监控服务
 * 
 * 使用方式（在 AI 对话中）:
 * /mcp incident-monitor
 * 
 * 可用工具:
 * - incident_start_monitoring: 开始监控
 * - incident_get_new_messages: 获取新消息
 * - incident_stop_monitoring: 停止监控
 * - incident_get_status: 获取状态
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';

// 状态管理
const monitors = new Map(); // channel -> monitor state

/**
 * 读取文件中的新消息
 */
function readNewMessages(filePath, sinceTs) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  return lines
    .map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    })
    .filter(msg => msg && msg.ts > sinceTs);
}

/**
 * 检测结束标记
 */
function checkEndMarker(messages) {
  const endKeywords = [
    '已解决', '已修复', 'resolved', 'fixed', 'closed',
    '结束', 'incident closed', '[CLOSED]',
  ];
  
  for (const msg of messages) {
    const text = msg.text.toLowerCase();
    if (endKeywords.some(keyword => text.includes(keyword.toLowerCase()))) {
      return true;
    }
  }
  
  return false;
}

// 创建 MCP Server
const server = new Server(
  {
    name: 'incident-monitor-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义可用工具
const tools = [
  {
    name: 'incident_start_monitoring',
    description: '开始监控一个事件文件或频道',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: '文件路径或频道名称',
        },
        interval: {
          type: 'number',
          default: 30,
          description: '轮询间隔（秒）',
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'incident_get_new_messages',
    description: '获取自上次检查以来的新消息',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: '文件路径或频道名称',
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'incident_stop_monitoring',
    description: '停止监控一个事件频道',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: '文件路径或频道名称',
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'incident_get_status',
    description: '获取监控状态',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: '文件路径或频道名称',
        },
      },
      required: ['channel'],
    },
  },
];

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[MCP] 调用工具：${name}`, args);

  try {
    switch (name) {
      case 'incident_start_monitoring': {
        return await handleStartMonitoring(args);
      }
      case 'incident_get_new_messages': {
        return await handleGetNewMessages(args);
      }
      case 'incident_stop_monitoring': {
        return await handleStopMonitoring(args);
      }
      case 'incident_get_status': {
        return await handleGetStatus(args);
      }
      default:
        throw new Error(`未知工具：${name}`);
    }
  } catch (error) {
    console.error(`[MCP] 工具调用错误：${name}`, error);
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
 * 工具：开始监控
 */
async function handleStartMonitoring(args) {
  const { channel, interval = 30 } = args;
  
  // 检查是否已在监控
  if (monitors.has(channel)) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'already_monitoring',
          channel,
          message: '该频道已在监控中',
        }),
      }],
    };
  }
  
  // 创建监控状态
  const state = {
    channel,
    interval: interval * 1000, // 转换为毫秒
    lastReadTs: '0',
    isActive: true,
    startTime: new Date().toISOString(),
    messageCount: 0,
  };
  
  monitors.set(channel, state);
  
  console.error(`[MCP] 开始监控：${channel}, 间隔：${interval}秒`);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'started',
        channel,
        interval,
        message: `已开始监控 ${channel}，每 ${interval} 秒检查一次`,
      }),
    }],
  };
}

/**
 * 工具：获取新消息
 */
async function handleGetNewMessages(args) {
  const { channel } = args;
  
  const state = monitors.get(channel);
  if (!state) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'not_monitoring',
          message: '该频道未在被监控',
        }),
      }],
    };
  }
  
  // 解析文件路径
  const filePath = path.isAbsolute(channel) ? channel : path.join(process.cwd(), channel);
  
  // 读取新消息
  const newMessages = readNewMessages(filePath, state.lastReadTs);
  
  if (newMessages.length === 0) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'no_new_messages',
          channel,
          message: '没有新消息',
        }),
      }],
    };
  }
  
  // 更新状态
  state.lastReadTs = newMessages[newMessages.length - 1].ts;
  state.messageCount += newMessages.length;
  
  // 检查结束标记
  const hasEndMarker = checkEndMarker(newMessages);
  if (hasEndMarker) {
    state.isActive = false;
    state.endTime = new Date().toISOString();
  }
  
  monitors.set(channel, state);
  
  console.error(`[MCP] 发现 ${newMessages.length} 条新消息`);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'has_new_messages',
        channel,
        messageCount: newMessages.length,
        messages: newMessages,
        hasEndMarker,
        formatted: newMessages.map(msg => 
          `[${new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString()}] ${msg.user}: ${msg.text}`
        ).join('\n'),
      }),
    }],
  };
}

/**
 * 工具：停止监控
 */
async function handleStopMonitoring(args) {
  const { channel } = args;
  
  const state = monitors.get(channel);
  if (!state) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'not_monitoring',
          message: '该频道未在被监控',
        }),
      }],
    };
  }
  
  state.isActive = false;
  state.endTime = new Date().toISOString();
  monitors.set(channel, state);
  
  console.error(`[MCP] 停止监控：${channel}`);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'stopped',
        channel,
        message: `已停止监控 ${channel}`,
      }),
    }],
  };
}

/**
 * 工具：获取状态
 */
async function handleGetStatus(args) {
  const { channel } = args;
  
  const state = monitors.get(channel);
  if (!state) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'not_monitoring',
          message: '该频道未在被监控',
        }),
      }],
    };
  }
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'monitoring',
        ...state,
      }),
    }],
  };
}

// 启动服务器
async function main() {
  console.error('[MCP] 启动 Incident Monitor MCP Server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[MCP] MCP Server 已启动');
}

main().catch((error) => {
  console.error('[MCP] 致命错误:', error);
  process.exit(1);
});
