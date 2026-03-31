/**
 * Incident Monitor - Qwen CLI 自定义工具
 * 
 * 使用方式（在 Qwen CLI 中）:
 * /tool incident_check_file data/messages.jsonl
 * /tool incident_get_state session-123
 * /tool incident_save_state session-123 {...}
 * /tool incident_write_confirm data/output.jsonl "内容"
 * /tool incident_execute_write data/output.jsonl "内容"
 */

import fs from 'fs';
import path from 'path';

const STATE_DIR = path.join(process.cwd(), 'data', 'states');
const LOG_FILE = path.join(process.cwd(), 'logs', 'incident-tools.log');

// 确保目录存在
if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志
function log(action, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    data,
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf-8');
}

/**
 * 检查文件变化
 * /tool incident_check_file data/messages.jsonl 5
 */
export function check_file(filePath, lastIndex = 0) {
  log('check_file', { filePath, lastIndex });
  
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: '文件不存在',
      hasChanged: false,
      lastIndex,
    };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const newLines = lines.slice(lastIndex);
  
  const result = {
    success: true,
    hasChanged: newLines.length > 0,
    newCount: newLines.length,
    newLines: newLines.map((line, i) => {
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
      } catch (e) {}
      
      // 纯文本
      return {
        ts: String(Date.now() / 1000 + i),
        user: 'unknown',
        text: line,
        format: 'text',
      };
    }),
    totalLines: lines.length,
    lastIndex: lines.length,
  };
  
  log('check_file_result', result);
  return result;
}

/**
 * 获取状态
 * /tool incident_get_state session-123
 */
export function get_state(sessionId) {
  log('get_state', { sessionId });
  
  const stateFile = path.join(STATE_DIR, `${sessionId}.json`);
  
  if (!fs.existsSync(stateFile)) {
    return {
      success: true,
      state: {
        lastReadIndex: 0,
        messageCount: 0,
        status: 'IDLE',
        lastActivity: Date.now(),
        draft: null,
      },
    };
  }
  
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  log('get_state_result', state);
  
  return {
    success: true,
    state,
  };
}

/**
 * 保存状态
 * /tool incident_save_state session-123 {"lastReadIndex":5,"messageCount":5}
 */
export function save_state(sessionId, stateData) {
  log('save_state', { sessionId, stateData });
  
  const stateFile = path.join(STATE_DIR, `${sessionId}.json`);
  
  // 读取现有状态
  let existingState = {};
  if (fs.existsSync(stateFile)) {
    existingState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  }
  
  // 合并状态
  const newState = {
    ...existingState,
    ...stateData,
    lastActivity: Date.now(),
  };
  
  // 写入
  fs.writeFileSync(stateFile, JSON.stringify(newState, null, 2), 'utf-8');
  
  log('save_state_result', { success: true });
  
  return {
    success: true,
    state: newState,
  };
}

/**
 * 写文件确认（返回草稿）
 * /tool incident_write_confirm data/output.jsonl "内容"
 */
export function write_confirm(filePath, content) {
  log('write_confirm', { filePath, content });
  
  return {
    success: true,
    type: 'draft',
    draft: {
      action: 'write_file',
      filePath,
      content,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 执行写入
 * /tool incident_execute_write data/output.jsonl "内容"
 */
export function execute_write(filePath, content) {
  log('execute_write', { filePath, content });
  
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // 追加模式
    fs.appendFileSync(filePath, content + '\n', 'utf-8');
    
    log('execute_write_result', { success: true });
    
    return {
      success: true,
      message: '写入成功',
    };
  } catch (error) {
    log('execute_write_error', { error: error.message });
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 计算轮询间隔（Token 优化）
 * /tool incident_calc_interval 1711953600000
 */
export function calc_interval(lastActivityTime) {
  const now = Date.now();
  const minutesSinceActivity = (now - lastActivityTime) / 60000;
  
  let interval, mode;
  
  if (minutesSinceActivity < 10) {
    interval = 30000;      // 30 秒
    mode = 'active';
  } else if (minutesSinceActivity < 60) {
    interval = 300000;     // 5 分钟
    mode = 'idle';
  } else {
    interval = 1800000;    // 30 分钟
    mode = 'sleep';
  }
  
  return {
    success: true,
    interval,
    intervalSeconds: interval / 1000,
    mode,
    minutesSinceActivity,
  };
}

/**
 * 检测结束标记
 * /tool incident_check_end "已修复 [CLOSED]"
 */
export function check_end(text) {
  const endKeywords = [
    '已解决', '已修复', '结束',
    'resolved', 'fixed', 'closed',
    '[closed]', '[resolved]',
    'incident closed',
  ];
  
  const lowerText = text.toLowerCase();
  const matchedKeyword = endKeywords.find(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  return {
    success: true,
    hasEndMarker: !!matchedKeyword,
    matchedKeyword,
  };
}

/**
 * 分析消息（判断状态）
 * /tool incident_analyze "API 错误，500"
 */
export function analyze_messages(messages) {
  const text = Array.isArray(messages) 
    ? messages.map(m => m.text || m).join(' ').toLowerCase()
    : messages.toLowerCase();
  
  // 检测结束标记
  const endCheck = check_end(text);
  if (endCheck.hasEndMarker) {
    return {
      success: true,
      status: 'READY_TO_CLOSE',
      missingInfo: [],
      suggestions: ['生成事件总结'],
      needsInvestigation: false,
    };
  }
  
  // 检测问题
  const hasProblem = /错误 |error| 故障 |issue| 问题 |down|500|404/.test(text);
  
  if (!hasProblem) {
    return {
      success: true,
      status: 'MONITORING',
      missingInfo: [],
      suggestions: ['继续监控'],
      needsInvestigation: false,
    };
  }
  
  // 检查完整性
  const missingInfo = [];
  
  if (!/影响 | 范围 |scope|user|client/.test(text)) {
    missingInfo.push('影响范围');
  }
  if (!/服务 |service|api|endpoint/.test(text)) {
    missingInfo.push('受影响的服务');
  }
  if (!/时间 |when|start|begin/.test(text)) {
    missingInfo.push('问题开始时间');
  }
  if (!/错误率 |rate|percentage|%/.test(text)) {
    missingInfo.push('错误率/严重程度');
  }
  
  // 判断状态
  if (missingInfo.length > 2) {
    return {
      success: true,
      status: 'WAITING_INFO',
      missingInfo,
      suggestions: ['生成追问问题'],
      needsInvestigation: false,
    };
  }
  
  if (missingInfo.length > 0) {
    return {
      success: true,
      status: 'INVESTIGATING',
      missingInfo,
      suggestions: ['建议调查方向'],
      needsInvestigation: true,
    };
  }
  
  return {
    success: true,
    status: 'READY_TO_REPLY',
    missingInfo: [],
    suggestions: ['生成回复草稿'],
    needsInvestigation: false,
  };
}

// 导出所有工具
export const tools = {
  check_file,
  get_state,
  save_state,
  write_confirm,
  execute_write,
  calc_interval,
  check_end,
  analyze_messages,
};

// CLI 支持
if (process.argv[2]) {
  const [tool, ...args] = process.argv.slice(2);
  
  if (tools[tool]) {
    const result = tools[tool](...args);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error(`未知工具：${tool}`);
    process.exit(1);
  }
}
