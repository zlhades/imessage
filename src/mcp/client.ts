/**
 * MCP Client
 * 
 * Manages connections to MCP servers and provides a unified interface
 * for calling tools across different servers.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface MCPConfig {
  servers: Record<string, MCPServerConfig>;
}

export interface ToolCallResult {
  content: Array<{
    type: string;
    text: string;
    isError?: boolean;
  }>;
}

class MCPClient extends EventEmitter {
  private clients: Map<string, Client> = new Map();
  private config: MCPConfig;

  constructor(config: MCPConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize all enabled MCP servers
   */
  async initialize(): Promise<void> {
    console.error('[MCP Client] Initializing servers...');

    if (!this.config.servers) {
      console.error('[MCP Client] No servers configured');
      return;
    }

    for (const [name, serverConfig] of Object.entries(this.config.servers)) {
      if (!serverConfig.enabled) {
        console.error(`[MCP Client] Skipping disabled server: ${name}`);
        continue;
      }

      try {
        await this.connectServer(name, serverConfig);
        console.error(`[MCP Client] Server connected: ${name}`);
      } catch (error) {
        console.error(`[MCP Client] Failed to connect server ${name}:`, error);
        this.emit('server:error', { name, error });
      }
    }

    console.error('[MCP Client] Initialization complete');
  }

  /**
   * Connect to a single MCP server
   */
  private async connectServer(
    name: string,
    config: MCPServerConfig
  ): Promise<void> {
    // Spawn the server process
    const serverProcess = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.on('error', (error) => {
      console.error(`[MCP Client] Server ${name} error:`, error);
      this.emit('server:error', { name, error });
    });

    serverProcess.on('exit', (code) => {
      console.error(`[MCP Client] Server ${name} exited with code ${code}`);
      this.emit('server:exit', { name, code });
    });

    // Create transport
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });

    // Create client
    const client = new Client(
      {
        name: 'incident-bot-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    await client.connect(transport);
    this.clients.set(name, client);

    // Log available tools
    const tools = await client.listTools();
    console.error(
      `[MCP Client] Server ${name} provides ${tools.tools.length} tools:`,
      tools.tools.map((t) => t.name).join(', ')
    );
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<ToolCallResult> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server not found: ${serverName}`);
    }

    console.error(`[MCP Client] Calling ${serverName}/${toolName}`, args);

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    return result as ToolCallResult;
  }

  /**
   * Call a tool with auto-discovery of server
   */
  async callToolAuto(
    toolName: string,
    args: Record<string, any>
  ): Promise<ToolCallResult> {
    // Find which server provides this tool
    for (const [serverName, client] of this.clients.entries()) {
      try {
        const tools = await client.listTools();
        if (tools.tools.some((t) => t.name === toolName)) {
          return this.callTool(serverName, toolName, args);
        }
      } catch (error) {
        console.error(
          `[MCP Client] Error checking server ${serverName}:`,
          error
        );
      }
    }

    throw new Error(`Tool not found: ${toolName}`);
  }

  /**
   * Get all available tools
   */
  async listAllTools(): Promise<
    Array<{ server: string; name: string; description: string }>
  > {
    const allTools: Array<{
      server: string;
      name: string;
      description: string;
    }> = [];

    for (const [serverName, client] of this.clients.entries()) {
      try {
        const tools = await client.listTools();
        for (const tool of tools.tools) {
          allTools.push({
            server: serverName,
            name: tool.name,
            description: tool.description || '',
          });
        }
      } catch (error) {
        console.error(
          `[MCP Client] Error listing tools for ${serverName}:`,
          error
        );
      }
    }

    return allTools;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    console.error('[MCP Client] Closing all connections...');

    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
        console.error(`[MCP Client] Closed connection: ${name}`);
      } catch (error) {
        console.error(`[MCP Client] Error closing ${name}:`, error);
      }
    }

    this.clients.clear();
  }
}

// Singleton instance
let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(config?: MCPConfig): MCPClient {
  if (!mcpClientInstance && config) {
    mcpClientInstance = new MCPClient(config);
  }
  if (!mcpClientInstance) {
    throw new Error('MCP Client not initialized. Call initialize() first.');
  }
  return mcpClientInstance;
}

export async function initializeMCPClient(
  config: MCPConfig
): Promise<MCPClient> {
  if (mcpClientInstance) {
    await mcpClientInstance.close();
  }
  mcpClientInstance = new MCPClient(config);
  await mcpClientInstance.initialize();
  return mcpClientInstance;
}
