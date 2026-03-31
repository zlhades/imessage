/**
 * ============================================================================
 * State Persistence - 状态持久化
 * ============================================================================
 * 
 * 本模块管理运行时状态的持久化和恢复。
 * 
 * 持久化的数据:
 * - last_pull_ts: 最后一次拉取消息的时间戳
 * - processed_message_ids: 已处理的消息 ID 列表
 * - pending_draft: 待发送的草稿
 * - local_inputs: 本地输入历史
 * - incident_history: 事件历史记录
 * 
 * 存储方式:
 * - JSON 文件存储在 data/state.json
 * - 定期自动保存（每 10 秒）
 * - 程序启动时自动恢复
 * 
 * 使用示例:
 * ```typescript
 * // 加载状态
 * const state = loadState();
 * 
 * // 更新最后拉取时间
 * updateLastPullTs('1234567890');
 * 
 * // 标记消息为已处理
 * markMessagesProcessed(['msg1', 'msg2']);
 * 
 * // 添加本地输入
 * addLocalInput({ text: '...', timestamp: Date.now(), type: 'SUPPLEMENT' });
 * ```
 * 
 * @module config/state
 */

import fs from 'fs';
import path from 'path';
import { LocalInput } from '../ai/provider.js';

// ============================================================================
// 常量和路径
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');  // 数据目录
const STATE_FILE = path.join(DATA_DIR, 'state.json');  // 状态文件路径

/**
 * ============================================================================
 * 状态数据结构
 * ============================================================================
 */

export interface PersistedState {
  /**
   * 最后一次成功拉取消息的时间戳
   * 格式：Unix timestamp (秒)
   */
  last_pull_ts: string;

  /**
   * 已处理的消息 ID 列表
   * 用于避免重复处理同一条消息
   * 限制：最多保留 10000 条
   */
  processed_message_ids: string[];

  /**
   * 待发送的草稿（如果有）
   * 用于崩溃恢复
   */
  pending_draft?: {
    channel: string;
    text: string;
    thread_ts?: string;
    pull_ts: string;
  };

  /**
   * 本地输入历史
   * 用于在会话间保持上下文
   * 限制：最多保留 100 条
   */
  local_inputs: LocalInput[];

  /**
   * 事件历史记录
   * 用于统计和审计
   */
  incident_history: Array<{
    id: string;              // 事件 ID
    channel: string;         // 频道
    start_ts: string;        // 开始时间
    end_ts?: string;         // 结束时间
    status: 'open' | 'resolved' | 'closed';  // 状态
    summary?: string;        // 总结
  }>;
}

/**
 * ============================================================================
 * 工具函数
 * ============================================================================
 */

/**
 * 确保数据目录存在
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[State] Created data directory:', DATA_DIR);
  }
}

/**
 * ============================================================================
 * 状态加载和保存
 * ============================================================================
 */

/**
 * 从文件加载状态
 * 
 * 如果文件不存在或解析失败，返回默认状态。
 * 
 * @returns 状态对象
 */
export function loadState(): PersistedState {
  ensureDataDir();

  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      const state = JSON.parse(content);
      
      console.log('[State] Loaded state from file');
      
      return {
        last_pull_ts: state.last_pull_ts || '0',
        processed_message_ids: state.processed_message_ids || [],
        pending_draft: state.pending_draft,
        local_inputs: state.local_inputs || [],
        incident_history: state.incident_history || [],
      };
    }
  } catch (error) {
    console.error('[State] Failed to load state:', error);
  }

  // 返回默认状态
  return {
    last_pull_ts: '0',
    processed_message_ids: [],
    pending_draft: undefined,
    local_inputs: [],
    incident_history: [],
  };
}

/**
 * 保存状态到文件
 * 
 * @param state 状态对象
 */
export function saveState(state: PersistedState): void {
  ensureDataDir();

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('[State] State saved');
  } catch (error) {
    console.error('[State] Failed to save state:', error);
  }
}

/**
 * ============================================================================
 * 状态更新函数
 * ============================================================================
 */

/**
 * 更新最后拉取时间戳
 * 
 * 每次成功拉取 Slack 消息后调用。
 * 
 * @param ts 时间戳（秒）
 * @returns 更新后的状态
 */
export function updateLastPullTs(ts: string): PersistedState {
  const state = loadState();
  state.last_pull_ts = ts;
  saveState(state);
  return state;
}

/**
 * 标记消息为已处理
 * 
 * 处理完消息后调用，避免重复处理。
 * 
 * @param messageIds 消息 ID 列表
 * @returns 更新后的状态
 */
export function markMessagesProcessed(messageIds: string[]): PersistedState {
  const state = loadState();
  
  // 使用 Set 去重
  const processedSet = new Set([...state.processed_message_ids, ...messageIds]);
  state.processed_message_ids = Array.from(processedSet);
  
  // 限制数组大小（保留最近 10000 条）
  if (state.processed_message_ids.length > 10000) {
    state.processed_message_ids = state.processed_message_ids.slice(-10000);
  }
  
  saveState(state);
  return state;
}

/**
 * 检查消息是否已处理
 * 
 * @param messageId 消息 ID
 * @returns 是否已处理
 */
export function isMessageProcessed(messageId: string): boolean {
  const state = loadState();
  return state.processed_message_ids.includes(messageId);
}

/**
 * 添加本地输入
 * 
 * 用户在本地终端输入信息后调用。
 * 
 * @param input 本地输入
 * @returns 更新后的状态
 */
export function addLocalInput(input: LocalInput): PersistedState {
  const state = loadState();
  state.local_inputs.push(input);
  
  // 限制数组大小（保留最近 100 条）
  if (state.local_inputs.length > 100) {
    state.local_inputs = state.local_inputs.slice(-100);
  }
  
  saveState(state);
  return state;
}

/**
 * 获取最近的本地输入
 * 
 * @param limit 数量限制
 * @returns 本地输入列表
 */
export function getRecentLocalInputs(limit: number = 10): LocalInput[] {
  const state = loadState();
  return state.local_inputs.slice(-limit);
}

/**
 * 清空本地输入
 * 
 * 通常在新的会话开始时调用。
 * 
 * @returns 更新后的状态
 */
export function clearLocalInputs(): PersistedState {
  const state = loadState();
  state.local_inputs = [];
  saveState(state);
  return state;
}

/**
 * ============================================================================
 * 事件历史记录
 * ============================================================================
 */

/**
 * 创建事件记录
 * 
 * 检测到新事件时调用。
 * 
 * @param params 事件参数
 * @returns 更新后的状态
 */
export function createIncident(params: {
  id: string;
  channel: string;
  start_ts: string;
}): PersistedState {
  const state = loadState();
  
  state.incident_history.push({
    id: params.id,
    channel: params.channel,
    start_ts: params.start_ts,
    status: 'open',
  });
  
  saveState(state);
  return state;
}

/**
 * 更新事件状态
 * 
 * 事件解决或关闭时调用。
 * 
 * @param incidentId 事件 ID
 * @param status 新状态
 * @param summary 事件总结（可选）
 * @returns 更新后的状态
 */
export function updateIncidentStatus(
  incidentId: string,
  status: 'open' | 'resolved' | 'closed',
  summary?: string
): PersistedState {
  const state = loadState();
  
  const incident = state.incident_history.find((i) => i.id === incidentId);
  if (incident) {
    incident.status = status;
    incident.end_ts = String(Date.now());
    if (summary) {
      incident.summary = summary;
    }
  }
  
  saveState(state);
  return state;
}

/**
 * 获取未解决的事件
 * 
 * @returns 未解决的事件列表
 */
export function getOpenIncidents(): Array<{
  id: string;
  channel: string;
  start_ts: string;
}> {
  const state = loadState();
  return state.incident_history.filter((i) => i.status === 'open');
}

/**
 * 根据频道获取事件
 * 
 * @param channel 频道名
 * @returns 事件记录
 */
export function getIncidentByChannel(channel: string): any {
  const state = loadState();
  return state.incident_history.find(
    (i) => i.channel === channel && i.status === 'open'
  );
}

/**
 * ============================================================================
 * 定期保存器
 * ============================================================================
 * 
 * 定期自动保存状态，防止数据丢失。
 * 
 * 使用示例:
 * ```typescript
 * const saver = new PeriodicStateSaver(() => currentState, 10);
 * saver.start();
 * 
 * // 程序退出时
 * saver.stop();
 * ```
 */
export class PeriodicStateSaver {
  private intervalMs: number;
  private timer?: NodeJS.Timeout;
  private getStateFn: () => PersistedState;

  /**
   * 构造函数
   * 
   * @param getStateFn 获取状态的函数
   * @param intervalSeconds 保存间隔（秒），默认 10 秒
   */
  constructor(getStateFn: () => PersistedState, intervalSeconds: number = 10) {
    this.getStateFn = getStateFn;
    this.intervalMs = intervalSeconds * 1000;
  }

  /**
   * 启动定期保存
   */
  start(): void {
    this.timer = setInterval(() => {
      const state = this.getStateFn();
      saveState(state);
    }, this.intervalMs);
    
    console.log(`[State] Periodic saver started (interval: ${this.intervalMs / 1000}s)`);
  }

  /**
   * 停止定期保存
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
      console.log('[State] Periodic saver stopped');
    }
  }
}
