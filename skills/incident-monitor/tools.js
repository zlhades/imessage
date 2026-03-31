/**
 * Incident Monitor 技能 - 工具函数
 * 
 * 提供文件读写、状态管理、确认机制等功能
 */

import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'logs', 'incident-skill.log');

// 确保日志目录存在
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志函数
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...data };
  fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf-8');
  
  if (level === 'error' || process.env.DEBUG === 'true') {
    console.error(`[SKILL ${level.toUpperCase()}] ${message}`, data);
  }
}

/**
 * 读取文件内容
 * @param {string} filePath - 文件路径
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
export async function read_file(filePath) {
  log('info', '读取文件', { filePath });
  
  try {
    if (!fs.existsSync(filePath)) {
      log('warn', '文件不存在', { filePath });
      return { success: false, error: '文件不存在' };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    log('info', '读取成功', { filePath, lineCount: lines.length });
    
    return {
      success: true,
      content,
      lines,
      lineCount: lines.length,
    };
  } catch (error) {
    log('error', '读取文件失败', { filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * 写入文件（带确认标记）
 * @param {string} filePath - 文件路径
 * @param {string} content - 内容
 * @param {boolean} requireConfirm - 是否需要确认
 * @returns {Promise<{success: boolean, confirmed?: boolean}>}
 */
export async function write_file(filePath, content, requireConfirm = true) {
  log('info', '写入文件请求', { filePath, contentLength: content.length, requireConfirm });
  
  if (requireConfirm) {
    // 返回草稿，等待确认
    return {
      success: false,
      confirmed: false,
      draft: {
        filePath,
        content,
        action: 'write_file',
      },
    };
  }
  
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content, 'utf-8');
    log('info', '写入成功', { filePath });
    
    return { success: true, confirmed: true };
  } catch (error) {
    log('error', '写入文件失败', { filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * 执行写入（确认后调用）
 * @param {string} filePath - 文件路径
 * @param {string} content - 内容
 * @returns {Promise<{success: boolean}>}
 */
export async function execute_write(filePath, content) {
  log('info', '执行写入', { filePath });
  
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 追加模式（用于消息文件）
    fs.appendFileSync(filePath, content + '\n', 'utf-8');
    log('info', '写入成功', { filePath });
    
    return { success: true };
  } catch (error) {
    log('error', '执行写入失败', { filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * 检查文件变化
 * @param {string} filePath - 文件路径
 * @param {number} lastReadIndex - 上次读取的行索引
 * @returns {Promise<{hasChanged: boolean, newLines?: string[], lastIndex: number}>}
 */
export async function check_file_changed(filePath, lastReadIndex = 0) {
  log('info', '检查文件变化', { filePath, lastReadIndex });
  
  const result = await read_file(filePath);
  
  if (!result.success) {
    return { hasChanged: false, lastIndex: lastReadIndex };
  }
  
  const newLines = result.lines.slice(lastReadIndex);
  const hasChanged = newLines.length > 0;
  
  if (hasChanged) {
    log('info', '发现新消息', { filePath, newCount: newLines.length });
  } else {
    log('info', '没有新消息', { filePath });
  }
  
  return {
    hasChanged,
    newLines: hasChanged ? newLines : [],
    lastIndex: result.lines.length,
  };
}

/**
 * 计算轮询间隔（Token 优化）
 * @param {number} lastActivityTime - 最后活动时间戳（毫秒）
 * @returns {number} 轮询间隔（毫秒）
 */
export function calculate_polling_interval(lastActivityTime) {
  const now = Date.now();
  const minutesSinceActivity = (now - lastActivityTime) / 60000;
  
  if (minutesSinceActivity < 10) {
    return 30000;      // 活跃期：30 秒
  } else if (minutesSinceActivity < 60) {
    return 300000;     // 空闲期：5 分钟
  } else {
    return 1800000;    // 休眠期：30 分钟
  }
}

/**
 * 检测结束标记
 * @param {string[]} lines - 消息行
 * @returns {boolean}
 */
export function check_end_marker(lines) {
  const endKeywords = [
    '已解决', '已修复', 'resolved', 'fixed', 'closed',
    '结束', 'incident closed', '[CLOSED]', '[RESOLVED]',
  ];
  
  for (const line of lines) {
    const text = line.toLowerCase();
    if (endKeywords.some(keyword => text.includes(keyword.toLowerCase()))) {
      log('info', '检测到结束标记', { keyword: lines.find(l => l.toLowerCase().includes('resolved') || l.toLowerCase().includes('closed') || l.includes('已修复') || l.includes('已解决')) });
      return true;
    }
  }
  
  return false;
}

/**
 * 解析消息行（支持 JSON 和纯文本）
 * @param {string} line - 消息行
 * @returns {{ts: string, user: string, text: string, format: 'json'|'text'}}
 */
export function parse_message(line) {
  // 尝试解析 JSON
  try {
    const parsed = JSON.parse(line);
    if (parsed.ts && parsed.user && parsed.text) {
      return {
        ts: parsed.ts,
        user: parsed.user,
        text: parsed.text,
        format: 'json',
      };
    }
  } catch (e) {
    // 不是 JSON，使用纯文本格式
  }
  
  // 纯文本格式
  return {
    ts: String(Date.now() / 1000),
    user: 'unknown',
    text: line,
    format: 'text',
  };
}

/**
 * 格式化消息用于显示
 * @param {string[]} lines - 消息行
 * @returns {string}
 */
export function format_messages(lines) {
  return lines.map((line, index) => {
    const msg = parse_message(line);
    const time = new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString();
    return `[${time}] ${msg.user}: ${msg.text}`;
  }).join('\n');
}

/**
 * 获取用户确认（模拟）
 * 在实际 AI 对话中，这会显示选项并等待用户输入
 * @param {object} draft - 草稿对象
 * @returns {Promise<'confirm'|'modify'|'cancel'|'supplement'>}
 */
export async function get_user_confirmation(draft) {
  log('info', '等待用户确认', { draft });
  
  // 在实际使用中，这会显示：
  // 📝 回复草稿:
  // {draft.content}
  //
  // 请选择:
  // [1] ✓ 确认发送
  // [2] ✏️ 修改草稿
  // [3] ❌ 取消
  // [4] 💬 补充信息
  
  // 这里返回一个占位符，实际由 AI 处理
  return 'pending';
}

/**
 * 状态管理
 */
export const state = {
  currentStatus: 'IDLE',
  monitoredFile: null,
  lastReadIndex: 0,
  messageCount: 0,
  lastActivity: Date.now(),
  draft: null,
  
  /**
   * 设置状态
   */
  setStatus(newStatus) {
    this.currentStatus = newStatus;
    this.lastActivity = Date.now();
    log('info', '状态变更', { from: this.currentStatus, to: newStatus });
  },
  
  /**
   * 获取状态
   */
  getStatus() {
    const minutesSinceActivity = (Date.now() - this.lastActivity) / 60000;
    return {
      status: this.currentStatus,
      file: this.monitoredFile,
      messageCount: this.messageCount,
      unreadCount: this.lastReadIndex < this.messageCount ? this.messageCount - this.lastReadIndex : 0,
      lastActivity: new Date(this.lastActivity).toISOString(),
      pollingInterval: calculate_polling_interval(this.lastActivity) / 1000,
      mode: minutesSinceActivity < 10 ? 'active' : minutesSinceActivity < 60 ? 'idle' : 'sleep',
    };
  },
  
  /**
   * 重置状态
   */
  reset() {
    this.currentStatus = 'IDLE';
    this.monitoredFile = null;
    this.lastReadIndex = 0;
    this.messageCount = 0;
    this.draft = null;
    log('info', '状态重置');
  },
};

/**
 * 判断规则引擎
 */
export const decision_engine = {
  /**
   * 分析消息并判断状态
   * @param {string[]} messages - 消息列表
   * @returns {{status: string, missingInfo: string[], suggestions: string[], needsInvestigation: boolean}}
   */
  analyze(messages) {
    const text = messages.join(' ').toLowerCase();
    
    // 规则 1: 检测结束标记
    if (check_end_marker(messages)) {
      return {
        status: 'READY_TO_CLOSE',
        missingInfo: [],
        suggestions: ['生成事件总结'],
        needsInvestigation: false,
      };
    }
    
    // 规则 2: 检查是否有问题报告
    const hasProblem = /错误 |error| 故障 |issue| 问题 |down|500|404/.test(text);
    
    if (!hasProblem) {
      return {
        status: 'MONITORING',
        missingInfo: [],
        suggestions: ['继续监控'],
        needsInvestigation: false,
      };
    }
    
    // 规则 3: 检查信息完整性
    const missingInfo = [];
    
    if (!/影响 | 范围 |scope|user|client|customer/.test(text)) {
      missingInfo.push('影响范围');
    }
    if (!/服务 |service|api|endpoint/.test(text)) {
      missingInfo.push('受影响的服务');
    }
    if (!/时间|when|start|begin/.test(text)) {
      missingInfo.push('问题开始时间');
    }
    if (!/错误率|rate|percentage|%/.test(text)) {
      missingInfo.push('错误率/严重程度');
    }
    
    // 规则 4: 判断状态
    if (missingInfo.length > 2) {
      return {
        status: 'WAITING_INFO',
        missingInfo,
        suggestions: ['生成追问问题'],
        needsInvestigation: false,
      };
    }
    
    if (missingInfo.length > 0) {
      return {
        status: 'INVESTIGATING',
        missingInfo,
        suggestions: ['建议调查方向', '检查日志/指标/代码'],
        needsInvestigation: true,
      };
    }
    
    // 信息完整，准备回复
    return {
      status: 'READY_TO_REPLY',
      missingInfo: [],
      suggestions: ['生成回复草稿'],
      needsInvestigation: false,
    };
  },
  
  /**
   * 生成追问问题
   * @param {string[]} missingInfo - 缺失的信息列表
   * @returns {string[]}
   */
  generate_questions(missingInfo) {
    const questionTemplates = {
      '影响范围': '请问大概有多少用户受到影响？',
      '受影响的服务': '具体是哪个服务或 API 端点受影响？',
      '问题开始时间': '问题是从什么时候开始的？',
      '错误率/严重程度': '错误率大概是多少？',
    };
    
    return missingInfo
      .slice(0, 3)
      .map(info => questionTemplates[info] || `请提供更多信息关于：${info}?`);
  },
  
  /**
   * 生成调查建议
   * @param {string} service - 服务名称
   * @returns {string[]}
   */
  generate_investigation_suggestions(service = '服务') {
    return [
      `检查 ${service} 的日志文件`,
      `查看 ${service} 的错误率指标`,
      `检查最近的代码部署`,
      `查看 ${service} 的依赖服务状态`,
    ];
  },
};

export default {
  read_file,
  write_file,
  execute_write,
  check_file_changed,
  calculate_polling_interval,
  check_end_marker,
  parse_message,
  format_messages,
  get_user_confirmation,
  state,
  decision_engine,
};
