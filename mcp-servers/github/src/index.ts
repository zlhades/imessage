/**
 * GitHub MCP Server
 * 
 * Provides GitHub integration via MCP protocol:
 * - get_recent_commits: Get recent commits from a repository
 * - get_recent_prs: Get recent pull requests
 * - get_commit_details: Get details of a specific commit
 * - search_issues: Search GitHub issues
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// Define available tools
const tools = [
  {
    name: 'github_get_recent_commits',
    description: 'Get recent commits from a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { 
          type: 'string', 
          description: 'Repository owner (e.g., "facebook")' 
        },
        repo: { 
          type: 'string', 
          description: 'Repository name (e.g., "react")' 
        },
        per_page: { 
          type: 'number', 
          default: 20, 
          description: 'Number of commits to retrieve' 
        },
        sha: { 
          type: 'string', 
          description: 'Branch, tag, or commit SHA' 
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_get_recent_prs',
    description: 'Get recent pull requests from a GitHub repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { 
          type: 'string', 
          description: 'Repository owner' 
        },
        repo: { 
          type: 'string', 
          description: 'Repository name' 
        },
        per_page: { 
          type: 'number', 
          default: 20, 
          description: 'Number of PRs to retrieve' 
        },
        state: { 
          type: 'string', 
          enum: ['open', 'closed', 'all'],
          default: 'open',
          description: 'PR state filter' 
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_get_commit_details',
    description: 'Get details of a specific commit',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { 
          type: 'string', 
          description: 'Repository owner' 
        },
        repo: { 
          type: 'string', 
          description: 'Repository name' 
        },
        ref: { 
          type: 'string', 
          description: 'Commit SHA, branch, or tag' 
        },
      },
      required: ['owner', 'repo', 'ref'],
    },
  },
  {
    name: 'github_search_issues',
    description: 'Search GitHub issues',
    inputSchema: {
      type: 'object',
      properties: {
        q: { 
          type: 'string', 
          description: 'Search query (e.g., "is:issue is:open error")' 
        },
        per_page: { 
          type: 'number', 
          default: 20, 
          description: 'Number of issues to retrieve' 
        },
      },
      required: ['q'],
    },
  },
  {
    name: 'github_get_file_content',
    description: 'Get content of a file from GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { 
          type: 'string', 
          description: 'Repository owner' 
        },
        repo: { 
          type: 'string', 
          description: 'Repository name' 
        },
        path: { 
          type: 'string', 
          description: 'File path in the repository' 
        },
        ref: { 
          type: 'string', 
          description: 'Branch, tag, or commit SHA' 
        },
      },
      required: ['owner', 'repo', 'path'],
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'github-mcp',
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
  
  console.error(`[GitHub MCP] Calling tool: ${name}`, args);
  
  try {
    switch (name) {
      case 'github_get_recent_commits': {
        return await handleGetRecentCommits(args as any);
      }
      
      case 'github_get_recent_prs': {
        return await handleGetRecentPRs(args as any);
      }
      
      case 'github_get_commit_details': {
        return await handleGetCommitDetails(args as any);
      }
      
      case 'github_search_issues': {
        return await handleSearchIssues(args as any);
      }
      
      case 'github_get_file_content': {
        return await handleGetFileContent(args as any);
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`[GitHub MCP] Error calling ${name}:`, error);
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
 * Tool: github_get_recent_commits
 */
async function handleGetRecentCommits(args: {
  owner: string;
  repo: string;
  per_page?: number;
  sha?: string;
}) {
  const response = await octokit.repos.listCommits({
    owner: args.owner,
    repo: args.repo,
    per_page: args.per_page || 20,
    sha: args.sha,
  });

  const commits = response.data.map((commit) => ({
    sha: commit.sha,
    message: commit.commit?.message,
    author: commit.commit?.author?.name,
    date: commit.commit?.author?.date,
    url: commit.html_url,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(commits, null, 2),
      },
    ],
  };
}

/**
 * Tool: github_get_recent_prs
 */
async function handleGetRecentPRs(args: {
  owner: string;
  repo: string;
  per_page?: number;
  state?: 'open' | 'closed' | 'all';
}) {
  const response = await octokit.pulls.list({
    owner: args.owner,
    repo: args.repo,
    per_page: args.per_page || 20,
    state: args.state || 'open',
    sort: 'updated',
    direction: 'desc',
  });

  const prs = response.data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    user: pr.user?.login,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    url: pr.html_url,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(prs, null, 2),
      },
    ],
  };
}

/**
 * Tool: github_get_commit_details
 */
async function handleGetCommitDetails(args: {
  owner: string;
  repo: string;
  ref: string;
}) {
  const response = await octokit.repos.getCommit({
    owner: args.owner,
    repo: args.repo,
    ref: args.ref,
  });

  const commit = {
    sha: response.data.sha,
    message: response.data.commit?.message,
    author: response.data.commit?.author?.name,
    date: response.data.commit?.author?.date,
    url: response.data.html_url,
    files: response.data.files?.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
    })),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(commit, null, 2),
      },
    ],
  };
}

/**
 * Tool: github_search_issues
 */
async function handleSearchIssues(args: {
  q: string;
  per_page?: number;
}) {
  const response = await octokit.search.issuesAndPullRequests({
    q: args.q,
    per_page: args.per_page || 20,
  });

  const issues = response.data.items.map((issue) => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    user: issue.user?.login,
    created_at: issue.created_at,
    labels: issue.labels?.map((l) => l.name),
    url: issue.html_url,
  }));

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            total_count: response.data.total_count,
            items: issues,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Tool: github_get_file_content
 */
async function handleGetFileContent(args: {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}) {
  const response = await octokit.repos.getContent({
    owner: args.owner,
    repo: args.repo,
    path: args.path,
    ref: args.ref,
  });

  const file = response.data;
  
  if (!('content' in file)) {
    throw new Error('Not a file');
  }

  const content = Buffer.from(file.content, 'base64').toString('utf-8');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            path: file.path,
            sha: file.sha,
            size: file.size,
            content: content,
            url: file.html_url,
          },
          null,
          2
        ),
      },
    ],
  };
}

// Start the server
async function main() {
  console.error('[GitHub MCP] Starting server...');
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[GitHub MCP] Server started successfully');
}

main().catch((error) => {
  console.error('[GitHub MCP] Fatal error:', error);
  process.exit(1);
});
