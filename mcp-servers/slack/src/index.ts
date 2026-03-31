/**
 * Slack MCP Server
 * 
 * Provides Slack integration via MCP protocol:
 * - get_messages: Pull messages from a channel
 * - send_message: Send a message to a channel
 * - check_new_messages: Check for new messages since a timestamp
 * - get_thread_replies: Get replies to a thread
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebClient } from '@slack/web-api';

// Initialize Slack Web API client
const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const botUserId = process.env.SLACK_BOT_USER_ID || 'U01234567';

// Define available tools
const tools = [
  {
    name: 'slack_get_messages',
    description: 'Pull messages from a Slack channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { 
          type: 'string', 
          description: 'Channel name (e.g., #incidents) or ID' 
        },
        limit: { 
          type: 'number', 
          default: 50, 
          description: 'Number of messages to retrieve' 
        },
        oldest: { 
          type: 'string', 
          description: 'Unix timestamp of oldest message (for pagination)' 
        },
        latest: { 
          type: 'string', 
          description: 'Unix timestamp of latest message (for pagination)' 
        },
      },
      required: ['channel'],
    },
  },
  {
    name: 'slack_send_message',
    description: 'Send a message to a Slack channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { 
          type: 'string', 
          description: 'Channel name (e.g., #incidents) or ID' 
        },
        text: { 
          type: 'string', 
          description: 'Message text to send' 
        },
        thread_ts: { 
          type: 'string', 
          description: 'Thread timestamp (send as reply to a thread)' 
        },
      },
      required: ['channel', 'text'],
    },
  },
  {
    name: 'slack_check_new_messages',
    description: 'Check for new messages since a timestamp (for pre-send verification)',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { 
          type: 'string', 
          description: 'Channel name or ID' 
        },
        since_ts: { 
          type: 'string', 
          description: 'Check for messages after this timestamp' 
        },
        thread_ts: { 
          type: 'string', 
          description: 'Thread timestamp (optional, check within a thread)' 
        },
      },
      required: ['channel', 'since_ts'],
    },
  },
  {
    name: 'slack_get_thread_replies',
    description: 'Get replies to a specific thread',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { 
          type: 'string', 
          description: 'Channel name or ID' 
        },
        thread_ts: { 
          type: 'string', 
          description: 'Thread timestamp (parent message)' 
        },
      },
      required: ['channel', 'thread_ts'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'slack-incident-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool list request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool call request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[Slack MCP] Calling tool: ${name}`, args);
  
  try {
    switch (name) {
      case 'slack_get_messages': {
        return await handleGetMessages(args as any);
      }
      
      case 'slack_send_message': {
        return await handleSendMessage(args as any);
      }
      
      case 'slack_check_new_messages': {
        return await handleCheckNewMessages(args as any);
      }
      
      case 'slack_get_thread_replies': {
        return await handleGetThreadReplies(args as any);
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[Slack MCP] Error calling ${name}:`, error);
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
 * Tool: slack_get_messages
 * Pull messages from a Slack channel
 */
async function handleGetMessages(args: {
  channel: string;
  limit?: number;
  oldest?: string;
  latest?: string;
}) {
  const result = await webClient.conversations.history({
    channel: args.channel,
    limit: args.limit || 50,
    oldest: args.oldest,
    latest: args.latest,
  });
  
  if (!result.ok || !result.messages) {
    throw new Error(result.error || 'Failed to get messages');
  }
  
  // Convert messages to string for MCP response
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result.messages, null, 2),
      },
    ],
  };
}

/**
 * Tool: slack_send_message
 * Send a message to a Slack channel
 */
async function handleSendMessage(args: {
  channel: string;
  text: string;
  thread_ts?: string;
}) {
  const result = await webClient.chat.postMessage({
    channel: args.channel,
    text: args.text,
    thread_ts: args.thread_ts,
  });
  
  if (!result.ok || !result.ts) {
    throw new Error(result.error || 'Failed to send message');
  }
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            ok: result.ok,
            ts: result.ts,
            channel: result.channel,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Tool: slack_check_new_messages
 * Check for new messages since a timestamp
 */
async function handleCheckNewMessages(args: {
  channel: string;
  since_ts: string;
  thread_ts?: string;
}) {
  const result = await webClient.conversations.history({
    channel: args.channel,
    oldest: args.since_ts,
    limit: 100,
  });
  
  if (!result.ok || !result.messages) {
    throw new Error(result.error || 'Failed to check messages');
  }
  
  // Filter out messages from the bot itself and messages before since_ts
  const newMessages = result.messages.filter(
    (m) => m.ts > args.since_ts && m.user !== botUserId
  );
  
  // If thread_ts is provided, only include messages from that thread
  let filteredMessages = newMessages;
  if (args.thread_ts) {
    filteredMessages = newMessages.filter((m) => m.thread_ts === args.thread_ts);
  }
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            hasNewMessages: filteredMessages.length > 0,
            count: filteredMessages.length,
            messages: filteredMessages,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Tool: slack_get_thread_replies
 * Get replies to a specific thread
 */
async function handleGetThreadReplies(args: {
  channel: string;
  thread_ts: string;
}) {
  const result = await webClient.conversations.replies({
    channel: args.channel,
    ts: args.thread_ts,
  });
  
  if (!result.ok || !result.messages) {
    throw new Error(result.error || 'Failed to get thread replies');
  }
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result.messages, null, 2),
      },
    ],
  };
}

// Start the server
async function main() {
  console.error('[Slack MCP] Starting server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[Slack MCP] Server started successfully');
}

main().catch((error) => {
  console.error('[Slack MCP] Fatal error:', error);
  process.exit(1);
});
