/**
 * Prometheus MCP Server
 * 
 * Provides Prometheus/PromQL integration via MCP protocol:
 * - query: Execute a PromQL query
 * - query_range: Execute a range query
 * - get_alerts: Get current alerts from Alertmanager
 * - get_metrics: List available metrics
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://localhost:9090';
const PROMETHEUS_API_KEY = process.env.PROMETHEUS_API_KEY;

// Define available tools
const tools = [
  {
    name: 'prometheus_query',
    description: 'Execute an instant PromQL query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'PromQL query (e.g., "up", "http_requests_total")' 
        },
        time: { 
          type: 'string', 
          description: 'RFC3339 or Unix timestamp (default: now)' 
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'prometheus_query_range',
    description: 'Execute a range PromQL query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'PromQL query' 
        },
        start: { 
          type: 'string', 
          description: 'Start time (RFC3339 or Unix timestamp)' 
        },
        end: { 
          type: 'string', 
          description: 'End time (RFC3339 or Unix timestamp)' 
        },
        step: { 
          type: 'string', 
          description: 'Query resolution step (e.g., "1m", "1h")' 
        },
      },
      required: ['query', 'start', 'end'],
    },
  },
  {
    name: 'prometheus_get_alerts',
    description: 'Get current alerts from Alertmanager',
    inputSchema: {
      type: 'object',
      properties: {
        active: { 
          type: 'boolean', 
          default: true, 
          description: 'Include active alerts' 
        },
        silenced: { 
          type: 'boolean', 
          default: false, 
          description: 'Include silenced alerts' 
        },
        filter: { 
          type: 'string', 
          description: 'Filter by alert name or label (e.g., "alertname=HighErrorRate")' 
        },
      },
    },
  },
  {
    name: 'prometheus_get_metrics',
    description: 'List available metrics matching a pattern',
    inputSchema: {
      type: 'object',
      properties: {
        match: { 
          type: 'string', 
          description: 'Metric name pattern (e.g., "http_*", "node_*")' 
        },
      },
    },
  },
  {
    name: 'prometheus_check_service_health',
    description: 'Check health status of a service',
    inputSchema: {
      type: 'object',
      properties: {
        service: { 
          type: 'string', 
          description: 'Service name (e.g., "api", "web", "database")' 
        },
        lookback: { 
          type: 'string', 
          default: '5m', 
          description: 'Time range to check (e.g., "5m", "1h")' 
        },
      },
      required: ['service'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'prometheus-mcp',
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
  
  console.error(`[Prometheus MCP] Calling tool: ${name}`, args);
  
  try {
    switch (name) {
      case 'prometheus_query': {
        return await handleQuery(args as any);
      }
      
      case 'prometheus_query_range': {
        return await handleQueryRange(args as any);
      }
      
      case 'prometheus_get_alerts': {
        return await handleGetAlerts(args as any);
      }
      
      case 'prometheus_get_metrics': {
        return await handleGetMetrics(args as any);
      }
      
      case 'prometheus_check_service_health': {
        return await handleCheckServiceHealth(args as any);
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[Prometheus MCP] Error calling ${name}:`, error);
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
 * Tool: prometheus_query
 */
async function handleQuery(args: {
  query: string;
  time?: string;
}) {
  const url = new URL(`${PROMETHEUS_URL}/api/v1/query`);
  url.searchParams.set('query', args.query);
  if (args.time) {
    url.searchParams.set('time', args.time);
  }

  const response = await fetchWithAuth(url.toString());
  const data = await response.json();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Tool: prometheus_query_range
 */
async function handleQueryRange(args: {
  query: string;
  start: string;
  end: string;
  step?: string;
}) {
  const url = new URL(`${PROMETHEUS_URL}/api/v1/query_range`);
  url.searchParams.set('query', args.query);
  url.searchParams.set('start', args.start);
  url.searchParams.set('end', args.end);
  if (args.step) {
    url.searchParams.set('step', args.step);
  }

  const response = await fetchWithAuth(url.toString());
  const data = await response.json();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Tool: prometheus_get_alerts
 */
async function handleGetAlerts(args: {
  active?: boolean;
  silenced?: boolean;
  filter?: string;
}) {
  const url = new URL(`${PROMETHEUS_URL}/api/v1/alerts`);
  
  const response = await fetchWithAuth(url.toString());
  const data = await response.json();

  let alerts = data.data?.groups?.flatMap((g: any) => g.rules || []) || [];
  
  // Filter active alerts
  if (args.active !== false) {
    alerts = alerts.filter((a: any) => a.state === 'firing' || a.state === 'pending');
  }

  // Filter by name/label
  if (args.filter) {
    alerts = alerts.filter((a: any) => 
      a.name?.includes(args.filter) || 
      JSON.stringify(a.labels).includes(args.filter)
    );
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            total: alerts.length,
            alerts: alerts.map((a: any) => ({
              name: a.name,
              state: a.state,
              severity: a.labels?.severity,
              description: a.annotations?.description || a.annotations?.summary,
              labels: a.labels,
              activeAt: a.activeAt,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Tool: prometheus_get_metrics
 */
async function handleGetMetrics(args: {
  match?: string;
}) {
  const url = new URL(`${PROMETHEUS_URL}/api/v1/label/__name__/values`);
  
  const response = await fetchWithAuth(url.toString());
  const data = await response.json();

  let metrics = data.data || [];
  
  // Filter by pattern
  if (args.match) {
    const pattern = args.match.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    metrics = metrics.filter((m: string) => regex.test(m));
  }

  // Limit results
  metrics = metrics.slice(0, 100);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            count: metrics.length,
            metrics: metrics,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Tool: prometheus_check_service_health
 */
async function handleCheckServiceHealth(args: {
  service: string;
  lookback?: string;
}) {
  const lookback = args.lookback || '5m';
  const service = args.service;

  // Check if service is up
  const upQuery = `up{service="${service}"}`;
  const upUrl = new URL(`${PROMETHEUS_URL}/api/v1/query`);
  upUrl.searchParams.set('query', upQuery);
  
  const upResponse = await fetchWithAuth(upUrl.toString());
  const upData = await upResponse.json();

  // Check error rate
  const errorQuery = `sum(rate(http_requests_total{service="${service}",status=~"5.."}[${lookback}]))`;
  const errorUrl = new URL(`${PROMETHEUS_URL}/api/v1/query`);
  errorUrl.searchParams.set('query', errorQuery);
  
  const errorResponse = await fetchWithAuth(errorUrl.toString());
  const errorData = await errorResponse.json();

  // Check latency
  const latencyQuery = `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{service="${service}"}[${lookback}])) by (le))`;
  const latencyUrl = new URL(`${PROMETHEUS_URL}/api/v1/query`);
  latencyUrl.searchParams.set('query', latencyQuery);
  
  const latencyResponse = await fetchWithAuth(latencyUrl.toString());
  const latencyData = await latencyResponse.json();

  const health = {
    service,
    timestamp: new Date().toISOString(),
    isUp: upData.data?.result?.[0]?.value?.[1] === '1',
    errorRate: errorData.data?.result?.[0]?.value?.[1] || '0',
    p95Latency: latencyData.data?.result?.[0]?.value?.[1] || 'N/A',
    status: determineHealthStatus(
      upData.data?.result?.[0]?.value?.[1] === '1',
      parseFloat(errorData.data?.result?.[0]?.value?.[1] || '0'),
      parseFloat(latencyData.data?.result?.[0]?.value?.[1] || '999')
    ),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(health, null, 2),
      },
    ],
  };
}

/**
 * Helper: Fetch with authentication
 */
async function fetchWithAuth(url: string): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (PROMETHEUS_API_KEY) {
    headers['Authorization'] = `Bearer ${PROMETHEUS_API_KEY}`;
  }

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Prometheus API error: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

/**
 * Helper: Determine health status
 */
function determineHealthStatus(
  isUp: boolean,
  errorRate: number,
  latency: number
): 'healthy' | 'degraded' | 'unhealthy' {
  if (!isUp) {
    return 'unhealthy';
  }
  
  if (errorRate > 0.1 || latency > 5) {
    return 'unhealthy';
  }
  
  if (errorRate > 0.01 || latency > 1) {
    return 'degraded';
  }
  
  return 'healthy';
}

// Start the server
async function main() {
  console.error('[Prometheus MCP] Starting server...');
  console.error(`[Prometheus MCP] URL: ${PROMETHEUS_URL}`);
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[Prometheus MCP] Server started successfully');
}

main().catch((error) => {
  console.error('[Prometheus MCP] Fatal error:', error);
  process.exit(1);
});
