/**
 * 文件读取器
 * 
 * 读取 JSONL 格式的消息文件
 * 每行格式：{"ts": "时间戳", "user": "用户 ID", "text": "消息内容", "thread_ts": "可选"}
 */

import fs from 'fs';

/**
 * 消息结构
 * @typedef {Object} Message
 * @property {string} ts - 时间戳
 * @property {string} user - 用户 ID
 * @property {string} text - 消息内容
 * @property {string} [thread_ts] - 线程 ID
 */

/**
 * 读取文件中的所有消息
 * @param {string} filePath - 文件路径
 * @returns {Message[]}
 */
export function readMessages(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.error(`[FileReader] 解析失败：${line}`);
      return null;
    }
  }).filter(msg => msg !== null);
}

/**
 * 读取新消息（指定时间戳之后）
 * @param {string} filePath - 文件路径
 * @param {string} sinceTs - 起始时间戳
 * @returns {Message[]}
 */
export function readNewMessages(filePath, sinceTs) {
  const allMessages = readMessages(filePath);
  return allMessages.filter(msg => msg.ts > sinceTs);
}

/**
 * 追加消息到文件
 * @param {string} filePath - 文件路径
 * @param {Message} message - 消息
 */
export function appendMessage(filePath, message) {
  const line = JSON.stringify(message) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
}

/**
 * 检测是否有结束标记
 * @param {Message[]} messages - 消息列表
 * @returns {boolean}
 */
export function checkEndMarker(messages) {
  const endKeywords = [
    '已解决',
    '已修复',
    'resolved',
    'fixed',
    'closed',
    '结束',
    'incident closed',
    '[CLOSED]',
  ];
  
  for (const msg of messages) {
    const text = msg.text.toLowerCase();
    if (endKeywords.some(keyword => text.includes(keyword.toLowerCase()))) {
      return true;
    }
  }
  
  return false;
}

/**
 * 格式化消息用于显示
 * @param {Message} msg 
 * @returns {string}
 */
export function formatMessage(msg) {
  const time = new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString();
  return `[${time}] ${msg.user}: ${msg.text}`;
}

/**
 * 格式化消息列表
 * @param {Message[]} messages 
 * @returns {string}
 */
export function formatMessages(messages) {
  return messages.map(formatMessage).join('\n');
}
