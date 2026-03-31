/**
 * Logger Configuration
 * 
 * Uses Winston for structured JSON logging with:
 * - Console output for development
 * - File output for production
 * - Different log levels
 * - Structured context
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'all.log'),
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // File transport for errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Add MCP-specific logger
export const mcpLogger = logger.child({
  module: 'MCP',
});

// Add Slack-specific logger
export const slackLogger = logger.child({
  module: 'Slack',
});

// Add AI-specific logger
export const aiLogger = logger.child({
  module: 'AI',
});

// Add CLI-specific logger
export const cliLogger = logger.child({
  module: 'CLI',
});

// Add approval-specific logger
export const approvalLogger = logger.child({
  module: 'Approval',
});

// Add investigation-specific logger
export const investigationLogger = logger.child({
  module: 'Investigation',
});

/**
 * Log an incident-related event
 */
export function logIncident(
  event: string,
  data: {
    incidentId?: string;
    channel?: string;
    user?: string;
    action?: string;
    [key: string]: any;
  }
): void {
  logger.info(`[Incident] ${event}`, {
    module: 'Incident',
    ...data,
  });
}

/**
 * Log a conversation state change
 */
export function logStateChange(
  from: string,
  to: string,
  reason?: string
): void {
  logger.info(`[State Change] ${from} → ${to}`, {
    module: 'Conversation',
    from,
    to,
    reason,
  });
}

/**
 * Log an approval flow event
 */
export function logApproval(
  event: string,
  data: {
    draft?: string;
    action?: 'confirm' | 'modify' | 'investigate' | 'supplement' | 'cancel';
    hasNewMessages?: boolean;
    [key: string]: any;
  }
): void {
  approvalLogger.info(`[Approval] ${event}`, data);
}

/**
 * Log an MCP tool call
 */
export function logToolCall(
  server: string,
  tool: string,
  args: Record<string, any>,
  result?: any
): void {
  mcpLogger.debug(`[Tool Call] ${server}/${tool}`, {
    args,
    result,
  });
}

/**
 * Log an AI request
 */
export function logAIRequest(
  provider: string,
  prompt: string,
  response?: string
): void {
  aiLogger.debug(`[AI] ${provider}`, {
    prompt,
    response,
  });
}

export default logger;
