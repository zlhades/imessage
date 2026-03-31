/**
 * 状态管理 - 文件存储
 * 
 * 每个监控会话一个状态文件：data/{channel}-state.json
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 状态结构
 * @typedef {Object} MonitorState
 * @property {string} channel - 频道/文件名
 * @property {string} lastReadTs - 最后读取的时间戳
 * @property {string[]} processedIds - 已处理的消息 ID
 * @property {boolean} isActive - 是否正在监控
 * @property {Date} startTime - 开始时间
 * @property {Date} [endTime] - 结束时间
 * @property {Object} [context] - 上下文信息
 */

/**
 * 获取状态文件路径
 */
function getStateFile(channel) {
  const safeName = channel.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `${safeName}-state.json`);
}

/**
 * 加载状态
 */
export function loadState(channel) {
  const file = getStateFile(channel);
  if (!fs.existsSync(file)) {
    return null;
  }
  const content = fs.readFileSync(file, 'utf-8');
  return JSON.parse(content);
}

/**
 * 保存状态
 */
export function saveState(channel, state) {
  const file = getStateFile(channel);
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * 创建新状态
 */
export function createState(channel) {
  return {
    channel,
    lastReadTs: '0',
    processedIds: [],
    isActive: true,
    startTime: new Date().toISOString(),
    context: {
      participants: new Set(),
      messageCount: 0,
      lastActivity: null,
    },
  };
}

/**
 * 标记消息为已处理
 */
export function markProcessed(channel, messageId) {
  const state = loadState(channel) || createState(channel);
  if (!state.processedIds.includes(messageId)) {
    state.processedIds.push(messageId);
    saveState(channel, state);
  }
}

/**
 * 检查消息是否已处理
 */
export function isProcessed(channel, messageId) {
  const state = loadState(channel);
  if (!state) return false;
  return state.processedIds.includes(messageId);
}

/**
 * 停止监控
 */
export function stopMonitoring(channel) {
  const state = loadState(channel);
  if (state) {
    state.isActive = false;
    state.endTime = new Date().toISOString();
    saveState(channel, state);
  }
}

/**
 * 获取所有活跃监控
 */
export function getActiveMonitors() {
  if (!fs.existsSync(DATA_DIR)) return [];
  
  const files = fs.readdirSync(DATA_DIR);
  const active = [];
  
  for (const file of files) {
    if (file.endsWith('-state.json')) {
      const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
      const state = JSON.parse(content);
      if (state.isActive) {
        active.push(state);
      }
    }
  }
  
  return active;
}
