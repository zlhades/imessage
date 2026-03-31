#!/usr/bin/env node
/**
 * ============================================================================
 * Slack AI Incident Response Bot - 主程序入口
 * ============================================================================
 *
 * 功能概述:
 * - 通过 MCP 协议连接 Slack/File，定时拉取消息
 * - 使用 AI (Qwen/Claude) 分析事件讨论
 * - 主动追问缺失信息、调用工具调查问题
 * - 发送前双重确认机制 (Pull → Confirm → 再 Pull → 发送)
 * - 支持本地交互，补充 Slack 没有的信息
 *
 * 运行模式:
 * - Daemon 模式：持续轮询 (默认)
 * - Check-and-run 模式：检查一次后退出 (用于 cron)
 * - File 模式：使用文件模拟 Slack (用于本地开发和测试)
 *
 * 使用方法:
 *   node dist/index.js              # Daemon 模式
 *   node dist/index.js --daemon     # 同上
 *   node dist/index.js --check-and-run  # Cron 模式
 *   node dist/index.js --help       # 显示帮助
 *
 * @module index
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { initializeMCPClient, getMCPClient } from './mcp/client.js';
import { getCLI } from './cli/interactive.js';
import logger, { slackLogger, aiLogger, approvalLogger } from './config/logger.js';
import { loadState, saveState, markMessagesProcessed, updateLastPullTs } from './config/state.js';
import { mergeContext, addLocalInput } from './conversation/merge.js';
import { createQwenProvider, createClaudeProvider } from './ai/index.js';
import { AIProvider, MergedContext, LocalInput } from './ai/provider.js';
import { executeInvestigation, formatInvestigationSummary } from './investigation/engine.js';
import {
  getApprovalGateway,
  formatDraftForDisplay,
  parseUserAction,
} from './approval/gateway.js';

// ============================================================================
// 模块变量
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 命令行参数解析
const args = process.argv.slice(2);
const checkAndRun = args.includes('--check-and-run');    // Cron 模式
const daemonMode = args.includes('--daemon') || !checkAndRun;  // Daemon 模式
const showHelp = args.includes('--help');                // 显示帮助

// ============================================================================
// 帮助信息
// ============================================================================

if (showHelp) {
  console.log(`
Slack AI Incident Response Bot

用法:
  node dist/index.js [options]

选项:
  --check-and-run   检查新消息后退出 (用于 cron)
  --daemon          守护进程模式 (持续轮询)
  --help            显示帮助信息

示例:
  # Cron 模式 (每分钟检查)
  node dist/index.js --check-and-run

  # 守护进程模式
  node dist/index.js --daemon
`);
  process.exit(0);
}

/**
 * ============================================================================
 * 加载配置文件
 * ============================================================================
 * 
 * 从 config/ 目录加载 YAML 配置文件，并替换环境变量
 * 
 * @returns 配置对象 { ai, slack, mcp }
 */
async function loadConfig() {
  // Use absolute path from project root
  const configDir = path.join(process.cwd(), 'config');
  
  /**
   * 解析 YAML 文件
   * @param file 文件名 (如 'ai-backend.yaml')
   * @returns 解析后的对象
   */
  const loadYAML = (file: string): any => {
    const content = fs.readFileSync(path.join(configDir, file), 'utf-8');
    return yaml.parse(content);
  };
  
  /**
   * 递归替换环境变量
   * 支持 ${ENV_VAR} 语法
   * @param obj 要处理的对象
   * @returns 替换后的对象
   */
  const substituteEnv = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/\${([^}]+)}/g, (_, envVar) => {
        return process.env[envVar] || '';
      });
    }
    if (Array.isArray(obj)) {
      return obj.map(substituteEnv);
    }
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = substituteEnv(value);
      }
      return result;
    }
    return obj;
  };
  
  // 加载三个配置文件
  const aiConfig = loadYAML('ai-backend.yaml');
  const slackConfig = loadYAML('slack.yaml');
  const mcpConfig = loadYAML('mcp.yaml');

  // 替换环境变量并返回，提供默认值
  return {
    ai: substituteEnv(aiConfig),
    slack: substituteEnv(slackConfig) || {
      channels: { incidents: '#incidents' },
      polling: { interval_seconds: 30, message_limit: 50 },
    },
    mcp: substituteEnv(mcpConfig),
  };
}

/**
 * ============================================================================
 * IncidentBot 主应用类
 * ============================================================================
 * 
 * 管理整个机器人的生命周期：
 * - 初始化 MCP 客户端和 AI Provider
 * - 定时拉取 Slack 消息
 * - AI 分析、调查、生成回复
 * - 发送前双重确认流程
 * - 状态持久化
 */
class IncidentBot {
  private config: any;           // 配置对象
  private aiProvider: AIProvider;  // AI Provider (Qwen 或 Claude)
  private localInputs: LocalInput[] = [];  // 本地输入（Slack 之外的信息）

  /**
   * 构造函数
   * 
   * 根据配置初始化 AI Provider：
   * - 如果 active='claude'，使用 ClaudeProvider
   * - 否则使用 QwenProvider
   * 
   * @param config 配置对象
   */
  constructor(config: any) {
    this.config = config;
    
    // 根据配置选择 AI Provider
    const activeProvider = this.config.ai.provider.active;
    if (activeProvider === 'claude') {
      this.aiProvider = createClaudeProvider(this.config.ai.provider.claude);
      logger.info('[IncidentBot] Using Claude Provider');
    } else {
      this.aiProvider = createQwenProvider(this.config.ai.provider.qwen);
      logger.info('[IncidentBot] Using Qwen Provider');
    }
  }

  /**
   * ============================================================================
   * 初始化机器人
   * ============================================================================
   * 
   * 执行以下初始化步骤：
   * 1. 初始化 MCP 客户端（连接所有配置的 MCP Servers）
   * 2. 检查 AI Provider 健康状态
   * 
   * @throws 如果 MCP 初始化失败
   */
  async initialize(): Promise<void> {
    logger.info('[IncidentBot] Initializing...');

    // 初始化 MCP 客户端
    const mcpConfig = {
      servers: this.config.mcp?.servers || {},
    };
    await initializeMCPClient(mcpConfig);
    logger.info('[IncidentBot] MCP Client initialized');

    // 检查 AI Provider 健康状态
    const aiHealthy = await this.aiProvider.healthCheck();
    if (!aiHealthy) {
      logger.warn('[IncidentBot] AI provider health check failed. Continuing anyway...');
    } else {
      logger.info('[IncidentBot] AI provider health check passed');
    }

    logger.info('[IncidentBot] Initialization complete');
  }

  /**
   * ============================================================================
   * 运行一次迭代
   * ============================================================================
   * 
   * 这是机器人的核心循环，执行以下步骤：
   * 
   * 1. 从 Slack 拉取新消息
   * 2. 过滤已处理的消息
   * 3. 显示消息到本地终端
   * 4. 合并本地输入
   * 5. AI 分析意图和完整性
   * 6. 根据分析结果决定行动：
   *    - 需要调查 → 执行调查计划
   *    - 信息不足 → 生成追问问题
   *    - 信息完整 → 生成回复并发送
   * 7. 更新状态（持久化）
   * 
   * @throws 如果处理过程中出现严重错误
   */
  async run(): Promise<void> {
    logger.info('[IncidentBot] Running iteration...');
    const cli = getCLI();

    try {
      // ----------------------------------------------------------------------
      // 步骤 1: 加载状态
      // ----------------------------------------------------------------------
      const state = loadState();
      
      // ----------------------------------------------------------------------
      // 步骤 2: 从 Slack 拉取消息
      // ----------------------------------------------------------------------
      const messages = await this.pullMessages(state.last_pull_ts);
      
      if (messages.length === 0) {
        logger.info('[IncidentBot] No new messages');
        return;
      }

      slackLogger.info(`[IncidentBot] Pulled ${messages.length} messages`);

      // ----------------------------------------------------------------------
      // 步骤 3: 过滤已处理的消息
      // ----------------------------------------------------------------------
      const newMessages = messages.filter(
        (m: any) => !state.processed_message_ids.includes(m.ts)
      );

      if (newMessages.length === 0) {
        logger.info('[IncidentBot] All messages already processed');
        return;
      }

      slackLogger.info(`[IncidentBot] ${newMessages.length} new messages`);

      // ----------------------------------------------------------------------
      // 步骤 4: 显示消息到本地终端
      // ----------------------------------------------------------------------
      cli.displayMessages(
        newMessages.map((m: any) => ({
          ts: m.ts,
          user: m.user,
          text: m.text,
          thread_ts: m.thread_ts,
        })),
        `New Messages (${newMessages.length})`
      );

      // ----------------------------------------------------------------------
      // 步骤 5: 合并 Slack 消息和本地输入
      // ----------------------------------------------------------------------
      const context = mergeContext(
        newMessages,
        this.localInputs,
        this.config.slack.channels.incidents
      );

      // ----------------------------------------------------------------------
      // 步骤 6: AI 分析
      // ----------------------------------------------------------------------
      cli.print('\n⏳ AI analyzing...');
      const analysis = await this.aiProvider.analyze(context);
      aiLogger.info('Analysis result:', analysis);

      // 显示分析结果
      cli.print(`\n📊 Analysis: ${analysis.intent.type} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);
      
      if (analysis.missingInfo.length > 0) {
        cli.print(`⚠️  Missing info: ${analysis.missingInfo.join(', ')}`);
      }

      // ----------------------------------------------------------------------
      // 步骤 7: 根据分析结果决定行动
      // ----------------------------------------------------------------------
      
      // 情况 A: 需要调查
      if (analysis.needsInvestigation) {
        cli.print('\n🔍 Starting investigation...');
        const investigation = await executeInvestigation(analysis.investigationPlan!, context);
        cli.print('\n' + formatInvestigationSummary(investigation));
        
        // 将调查结果加入上下文，重新分析
        const enhancedContext = addLocalInput(context, {
          text: formatInvestigationSummary(investigation),
          timestamp: Date.now(),
          type: 'SUPPLEMENT',
        });
        const newAnalysis = await this.aiProvider.analyze(enhancedContext);
        
        // 生成回复
        const response = await this.aiProvider.generateResponse(newAnalysis, enhancedContext);
        await this.handleApproval(response, context);
        
      } 
      // 情况 B: 信息不足，需要追问
      else if (analysis.missingInfo.length > 0) {
        // 生成追问问题
        const questions = await this.aiProvider.generateQuestions(analysis.missingInfo);
        cli.print('\n❓ Suggested questions:');
        questions.forEach((q, i) => cli.print(`  ${i + 1}. ${q}`));
        
        // 让用户选择或自定义问题
        const action = await cli.prompt({
          context: 'Choose a question to ask or enter custom text:',
          actions: [
            { key: '1', label: questions[0] || 'No question', value: questions[0] },
            { key: '2', label: questions[1] || 'No question', value: questions[1] },
            { key: '3', label: questions[2] || 'No question', value: questions[2] },
            { key: 'c', label: 'Custom input', value: 'custom' },
            { key: 's', label: 'Skip', value: 'skip' },
          ],
        });
        
        let messageText: string;
        if (action === 'custom') {
          // 用户输入自定义内容
          const customInput = await cli.prompt({
            context: 'Enter your message:',
            actions: [],
            allowCustomInput: true,
          });
          messageText = customInput;
        } else if (action === 'skip') {
          // 用户选择跳过
          messageText = '';
        } else {
          // 用户选择预设问题
          messageText = action;
        }
        
        // 发送消息
        if (messageText) {
          await this.sendToSlack(messageText, context);
        }
        
      } 
      // 情况 C: 信息完整，生成回复
      else if (analysis.suggestedResponse) {
        const response = analysis.suggestedResponse;
        await this.handleApproval(response, context);
      }

      // ----------------------------------------------------------------------
      // 步骤 8: 更新状态（持久化）
      // ----------------------------------------------------------------------
      const latestTs = messages.reduce(
        (max: string, m: any) => (m.ts > max ? m.ts : max),
        state.last_pull_ts
      );
      updateLastPullTs(latestTs);
      markMessagesProcessed(messages.map((m: any) => m.ts));

    } catch (error) {
      logger.error('[IncidentBot] Error during run:', error);
      throw error;
    }
  }

  /**
   * Handle approval flow
   */
  private async handleApproval(response: string, context: MergedContext): Promise<void> {
    const cli = getCLI();
    const gateway = getApprovalGateway();
    
    // Get current timestamp for first pull
    const pullTs = String(Date.now() / 1000);
    
    // Prepare draft
    await gateway.prepareDraft({
      channel: this.config.slack.channels.incidents,
      text: response,
      thread_ts: context.metadata.threadTs,
      pull_ts: pullTs,
      context,
    });
    
    // Show draft and get user action
    const draft = gateway.getState()?.draft;
    if (!draft) return;
    
    cli.print('\n' + formatDraftForDisplay(draft));
    
    const actionInput = await cli.prompt({
      context: '',
      actions: [
        { key: '1', label: '✓ 确认发送' },
        { key: '2', label: '✏️ 修改草稿' },
        { key: '3', label: '🔍 进一步调查' },
        { key: '4', label: '💬 补充本地信息' },
        { key: '5', label: '❌ 取消' },
      ],
      allowCustomInput: false,
    });
    
    const action = parseUserAction(actionInput);
    
    switch (action.action) {
      case 'confirm': {
        // Second pull check
        const checkResult = await gateway.confirm();
        
        if (checkResult.hasNewMessages) {
          cli.print(`\n⚠️  检测到 ${checkResult.newMessageCount} 条新消息，需要重新分析...`);
          gateway.clearState();
          // Re-run analysis with new context
          await this.run();
          return;
        }
        
        // Send message
        const sendResult = await gateway.send();
        cli.print(`\n✅ 消息已发送: ${sendResult.ts}`);
        break;
      }
      
      case 'modify': {
        const newText = await cli.prompt({
          context: '请输入修改后的内容:',
          actions: [],
          allowCustomInput: true,
        });
        await gateway.modify(newText);
        approvalLogger.info('Draft modified');
        // Retry approval
        await this.handleApproval(newText, context);
        break;
      }
      
      case 'investigate': {
        gateway.clearState();
        // Trigger investigation
        cli.print('\n🔍 Starting investigation...');
        // TODO: Implement investigation trigger
        break;
      }
      
      case 'supplement': {
        const supplementText = await cli.prompt({
          context: '请输入补充信息:',
          actions: [],
          allowCustomInput: true,
        });
        this.localInputs.push({
          text: supplementText,
          timestamp: Date.now(),
          type: 'SUPPLEMENT',
        });
        cli.print('✅ 补充信息已添加，将重新分析...');
        gateway.clearState();
        await this.run();
        break;
      }
      
      case 'cancel': {
        await gateway.cancel();
        cli.print('❌ 已取消发送');
        break;
      }
    }
  }

  /**
   * Send message to Slack
   */
  private async sendToSlack(text: string, context: MergedContext): Promise<void> {
    const cli = getCLI();
    const client = getMCPClient();
    
    cli.print('\n⏳ 发送消息到 Slack...');
    
    const result = await client.callTool('slack', 'slack_send_message', {
      channel: this.config.slack.channels.incidents,
      text,
      thread_ts: context.metadata.threadTs,
    });
    
    const response = JSON.parse(result.content[0].text);
    cli.print(`✅ 消息已发送：${response.ts}`);
  }

  /**
   * Pull messages from Slack via MCP
   */
  private async pullMessages(oldestTs: string): Promise<any[]> {
    const client = getMCPClient();
    
    try {
      const result = await client.callTool('slack', 'slack_get_messages', {
        channel: this.config.slack.channels.incidents,
        limit: this.config.slack.polling.message_limit,
        oldest: oldestTs,
      });

      const content = result.content[0];
      if (content.isError) {
        throw new Error(content.text);
      }

      return JSON.parse(content.text);
    } catch (error: any) {
      if (error.message.includes('SLACK_BOT_TOKEN') || error.message.includes('not_authed')) {
        slackLogger.warn('[PullMessages] Slack token not configured, skipping');
        return [];
      }
      throw error;
    }
  }

  /**
   * Run in daemon mode (continuous polling)
   */
  async runDaemon(): Promise<void> {
    const intervalSeconds = this.config.slack.polling.interval_seconds || 30;
    logger.info(`[IncidentBot] Starting daemon mode (interval: ${intervalSeconds}s)`);

    while (true) {
      try {
        await this.run();
      } catch (error) {
        logger.error('[IncidentBot] Error in daemon:', error);
      }

      // Wait for next interval
      await new Promise((resolve) =>
        setTimeout(resolve, intervalSeconds * 1000)
      );
    }
  }

  /**
   * Close the bot
   */
  async close(): Promise<void> {
    logger.info('[IncidentBot] Closing...');
    
    // Save state
    saveState(loadState());
    
    // Close MCP client
    try {
      await getMCPClient().close();
    } catch (error) {
      logger.warn('[IncidentBot] Error closing MCP client:', error);
    }
    
    logger.info('[IncidentBot] Closed');
  }
}

/**
 * Main entry point
 */
async function main() {
  logger.info('[Main] Starting Slack AI Incident Response Bot...');

  try {
    // Load configuration
    const config = await loadConfig();

    // Create bot instance
    const bot = new IncidentBot(config);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('[Main] Received SIGINT, shutting down...');
      await bot.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('[Main] Received SIGTERM, shutting down...');
      await bot.close();
      process.exit(0);
    });

    // Initialize
    await bot.initialize();

    // Run
    if (checkAndRun) {
      // Single run mode (for cron)
      await bot.run();
      await bot.close();
      logger.info('[Main] Check-and-run complete');
    } else {
      // Daemon mode
      await bot.runDaemon();
    }
  } catch (error) {
    logger.error('[Main] Fatal error:', error);
    process.exit(1);
  }
}

// Run main
main();
