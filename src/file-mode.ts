/**
 * ============================================================================
 * File Mode Adapter - 文件模式适配器
 * ============================================================================
 *
 * 本模块提供文件模式的运行能力，无需 Slack 即可测试机器人功能。
 *
 * 功能：
 * - 使用文件模拟 Slack 消息队列
 * - 自动检测新消息（通过文件时间戳或轮询）
 * - 支持 E2E 测试
 *
 * 使用方式：
 * 1. 向 data/messages.jsonl 添加消息（每行一条 JSON）
 * 2. 运行机器人
 * 3. 查看 data/output.jsonl 获取机器人回复
 *
 * @module file-mode
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 消息数据结构
 */
export interface FileMessage {
  ts: string;
  user: string;
  text: string;
  thread_ts?: string;
}

/**
 * 文件模式配置
 */
export interface FileModeConfig {
  messageFile: string;      // 输入消息文件
  outputFile: string;       // 输出消息文件
  pollIntervalMs: number;   // 轮询间隔（毫秒）
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FileModeConfig = {
  messageFile: path.join(process.cwd(), 'data', 'messages.jsonl'),
  outputFile: path.join(process.cwd(), 'data', 'output.jsonl'),
  pollIntervalMs: 1000,
};

/**
 * 确保文件存在
 */
function ensureFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf-8');
  }
}

/**
 * 读取消息文件
 */
export function readMessages(filePath: string): FileMessage[] {
  ensureFile(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter((line) => line.trim());
  return lines.map((line) => JSON.parse(line));
}

/**
 * 追加消息到文件
 */
export function appendMessage(filePath: string, message: FileMessage) {
  ensureFile(filePath);
  const line = JSON.stringify(message) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

/**
 * 清空消息文件
 */
export function clearMessages(filePath: string) {
  ensureFile(filePath);
  fs.writeFileSync(filePath, '', 'utf-8');
}

/**
 * 获取新消息（自上次检查后）
 */
export function getNewMessages(
  filePath: string,
  lastCheckTs: string
): FileMessage[] {
  const allMessages = readMessages(filePath);
  return allMessages.filter((m) => m.ts > lastCheckTs);
}

/**
 * 写入机器人回复
 */
export function writeBotResponse(
  filePath: string,
  response: string,
  threadTs?: string
) {
  const message: FileMessage = {
    ts: String(Date.now() / 1000),
    user: 'bot',
    text: response,
    thread_ts: threadTs,
  };
  appendMessage(filePath, message);
  return message;
}

/**
 * 打印文件内容（用于调试）
 */
export function printFileContent(filePath: string, title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 ${title}: ${filePath}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(filePath)) {
    console.log('(文件不存在)');
    return;
  }

  const messages = readMessages(filePath);
  if (messages.length === 0) {
    console.log('(空)');
    return;
  }

  messages.forEach((m, i) => {
    console.log(`\n[${i + 1}] ${new Date(parseFloat(m.ts) * 1000).toLocaleTimeString()} - ${m.user}`);
    console.log(`    ${m.text}`);
    if (m.thread_ts) {
      console.log(`    (thread: ${m.thread_ts})`);
    }
  });

  console.log('='.repeat(60) + '\n');
}

/**
 * 创建示例消息文件（用于测试）
 */
export function createSampleMessages(filePath: string) {
  const sampleMessages: FileMessage[] = [
    {
      ts: String(Date.now() / 1000),
      user: 'user1',
      text: '大家好，API 服务突然返回 500 错误！',
    },
    {
      ts: String(Date.now() / 1000 + 1),
      user: 'user2',
      text: '我也是，从 10 分钟前开始的。',
    },
    {
      ts: String(Date.now() / 1000 + 2),
      user: 'user1',
      text: '有人知道怎么回事吗？',
    },
  ];

  ensureFile(filePath);
  fs.writeFileSync(filePath, '', 'utf-8');
  sampleMessages.forEach((m) => appendMessage(filePath, m));

  console.log(`✅ 已创建 ${sampleMessages.length} 条示例消息到 ${filePath}`);
}

/**
 * 命令行工具：创建示例数据
 */
if (process.argv[2] === '--create-sample') {
  const targetFile = process.argv[3] || DEFAULT_CONFIG.messageFile;
  createSampleMessages(targetFile);
}

/**
 * 命令行工具：查看消息
 */
if (process.argv[2] === '--view') {
  const targetFile = process.argv[3] || DEFAULT_CONFIG.messageFile;
  printFileContent(targetFile, '消息内容');
}

/**
 * 命令行工具：清空消息
 */
if (process.argv[2] === '--clear') {
  const targetFile = process.argv[3] || DEFAULT_CONFIG.messageFile;
  clearMessages(targetFile);
  console.log(`✅ 已清空 ${targetFile}`);
}
