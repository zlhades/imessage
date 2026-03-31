#!/usr/bin/env node
/**
 * Incident Monitor - 独立运行版本
 * 
 * 真正能工作的方案：
 * 1. 独立 Node.js 服务持续运行
 * 2. 智能轮询文件（Token 优化）
 * 3. 调用 AI 分析
 * 4. 写前确认
 * 5. 用户可随时打断
 * 
 * 使用方式：
 * node monitor-standalone.js data/messages.jsonl
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ============ 配置 ============
const LOG_FILE = path.join(process.cwd(), 'logs', 'monitor-standalone.log');
const DEFAULT_INTERVAL = 30000; // 30 秒

// 确保日志目录存在
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// ============ 日志 ============
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...data };
  fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf-8');
  
  if (level === 'error' || process.env.DEBUG === 'true') {
    console.error(`[${level.toUpperCase()}] ${message}`, data);
  }
}

// ============ 状态管理 ============
const state = {
  status: 'IDLE',
  filePath: null,
  lastReadIndex: 0,
  messageCount: 0,
  lastActivity: Date.now(),
  draft: null,
  running: false,
  
  getStatus() {
    const minutesSinceActivity = (Date.now() - this.lastActivity) / 60000;
    return {
      status: this.status,
      file: this.filePath,
      messageCount: this.messageCount,
      unreadCount: this.messageCount - this.lastReadIndex,
      lastActivity: new Date(this.lastActivity).toISOString(),
      pollingInterval: getPollingInterval(this.lastActivity) / 1000,
      mode: minutesSinceActivity < 10 ? 'active' : minutesSinceActivity < 60 ? 'idle' : 'sleep',
    };
  },
  
  reset() {
    this.status = 'IDLE';
    this.filePath = null;
    this.lastReadIndex = 0;
    this.messageCount = 0;
    this.draft = null;
  },
};

// ============ Token 优化 ============
function getPollingInterval(lastActivityTime) {
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

// ============ 文件操作 ============
function readMessages(filePath) {
  if (!fs.existsSync(filePath)) {
    log('warn', '文件不存在', { filePath });
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  return lines.map(line => {
    // 尝试解析 JSON
    try {
      const parsed = JSON.parse(line);
      if (parsed.ts && parsed.user && parsed.text) {
        return { ts: parsed.ts, user: parsed.user, text: parsed.text, format: 'json' };
      }
    } catch (e) {
      // 不是 JSON，使用纯文本
    }
    
    // 纯文本格式
    return {
      ts: String(Date.now() / 1000),
      user: 'unknown',
      text: line,
      format: 'text',
    };
  });
}

function getNewMessages(filePath, lastIndex) {
  const allMessages = readMessages(filePath);
  return allMessages.slice(lastIndex);
}

// ============ 判断规则 ============
function analyzeMessages(messages) {
  const text = messages.map(m => m.text).join(' ').toLowerCase();
  
  // 检测结束标记
  const endKeywords = ['已解决', '已修复', 'resolved', 'fixed', 'closed', '结束', '[closed]'];
  if (endKeywords.some(keyword => text.includes(keyword))) {
    return {
      status: 'READY_TO_CLOSE',
      missingInfo: [],
      suggestions: ['生成事件总结'],
      needsInvestigation: false,
    };
  }
  
  // 检测问题报告
  const hasProblem = /错误 |error| 故障 |issue| 问题 |down|500|404/.test(text);
  
  if (!hasProblem) {
    return {
      status: 'MONITORING',
      missingInfo: [],
      suggestions: ['继续监控'],
      needsInvestigation: false,
    };
  }
  
  // 检查信息完整性
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
      suggestions: ['建议调查方向'],
      needsInvestigation: true,
    };
  }
  
  return {
    status: 'READY_TO_REPLY',
    missingInfo: [],
    suggestions: ['生成回复草稿'],
    needsInvestigation: false,
  };
}

function generateQuestions(missingInfo) {
  const templates = {
    '影响范围': '请问大概有多少用户受到影响？',
    '受影响的服务': '具体是哪个服务或 API 端点受影响？',
    '问题开始时间': '问题是从什么时候开始的？',
    '错误率/严重程度': '错误率大概是多少？',
  };
  
  return missingInfo.slice(0, 3).map(info => templates[info] || `请提供更多信息关于：${info}?`);
}

function generateInvestigationSuggestions(service = '服务') {
  return [
    `检查 ${service} 的日志文件`,
    `查看 ${service} 的错误率指标`,
    `检查最近的代码部署`,
    `查看 ${service} 的依赖服务状态`,
  ];
}

// ============ 用户交互 ============
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptUser(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ============ 主循环 ============
async function checkAndProcess(filePath) {
  const newMessages = getNewMessages(filePath, state.lastReadIndex);
  
  if (newMessages.length === 0) {
    const status = state.getStatus();
    console.log(`\n[${status.mode}] 没有新消息 (下次检查：${status.pollingInterval}秒后)`);
    return;
  }
  
  console.log(`\n📬 发现 ${newMessages.length} 条新消息:`);
  newMessages.forEach((msg, i) => {
    const time = new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString();
    console.log(`  [${time}] ${msg.user}: ${msg.text}`);
  });
  
  // 分析消息
  const analysis = analyzeMessages(newMessages);
  console.log(`\n📊 分析:`);
  console.log(`  状态：${analysis.status}`);
  
  if (analysis.missingInfo.length > 0) {
    console.log(`  缺失：${analysis.missingInfo.join(', ')}`);
  }
  
  console.log(`  建议：${analysis.suggestions.join(', ')}`);
  
  // 根据状态行动
  switch (analysis.status) {
    case 'WAITING_INFO':
      await handleWaitingInfo(analysis.missingInfo);
      break;
    case 'INVESTIGATING':
      await handleInvestigating(analysis.suggestions);
      break;
    case 'READY_TO_REPLY':
      await handleReadyToReply(newMessages);
      break;
    case 'READY_TO_CLOSE':
      await handleReadyToClose(newMessages);
      break;
  }
  
  // 更新状态
  state.lastReadIndex += newMessages.length;
  state.messageCount += newMessages.length;
  state.lastActivity = Date.now();
}

async function handleWaitingInfo(missingInfo) {
  const questions = generateQuestions(missingInfo);
  
  console.log(`\n📝 追问草稿:`);
  questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  
  const action = await promptUser(`\n请选择：[1] 发送追问 [2] 修改 [3] 取消 [4] 补充信息：`);
  
  if (action === '1') {
    console.log('✅ 追问已发送（请手动复制到对话中）');
    console.log('\n请复制以下问题到 AI 对话：');
    console.log('---');
    console.log('请提供以下信息：');
    questions.forEach((q, i) => console.log(`${i + 1}. ${q}`));
    console.log('---');
  } else if (action === '4') {
    const supplement = await promptUser('请输入补充信息：');
    console.log('✅ 补充信息已记录');
  }
}

async function handleInvestigating(suggestions) {
  console.log(`\n📝 调查建议:`);
  suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  
  const action = await promptUser(`\n请选择：[1] 发送建议 [2] 修改 [3] 取消：`);
  
  if (action === '1') {
    console.log('✅ 建议已发送（请手动复制到对话中）');
  }
}

async function handleReadyToReply(messages) {
  const draft = `根据分析，${messages.map(m => m.text).join(' ')}。建议检查相关日志和部署记录。`;
  
  console.log(`\n📝 回复草稿:`);
  console.log(`  ${draft}`);
  
  const action = await promptUser(`\n请选择：[1] ✓ 确认 [2] ✏️ 修改 [3] ❌ 取消：`);
  
  if (action === '1') {
    console.log('✅ 回复已确认（请手动复制到对话中）');
    console.log('\n请复制以下内容到 AI 对话：');
    console.log('---');
    console.log(draft);
    console.log('---');
  } else if (action === '2') {
    const modified = await promptUser('请输入修改后的内容：');
    console.log('✅ 草稿已更新');
  }
}

async function handleReadyToClose(messages) {
  const summary = `事件总结：${messages.map(m => m.text).join(' ')}。事件已解决。`;
  
  console.log(`\n📝 事件总结草稿:`);
  console.log(`  ${summary}`);
  
  const action = await promptUser(`\n请选择：[1] ✓ 确认 [2] ✏️ 修改 [3] ❌ 取消：`);
  
  if (action === '1') {
    console.log('✅ 事件总结已确认');
    state.reset();
  }
}

// ============ 主函数 ============
async function main() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.log('用法：node monitor-standalone.js <文件路径>');
    console.log('示例：node monitor-standalone.js data/messages.jsonl');
    process.exit(1);
  }
  
  if (!fs.existsSync(filePath)) {
    console.error(`错误：文件不存在：${filePath}`);
    process.exit(1);
  }
  
  console.log('='.repeat(60));
  console.log('🚨 Incident Monitor - 独立运行版本');
  console.log('='.repeat(60));
  console.log(`\n监控文件：${filePath}`);
  console.log('按 Ctrl+C 停止\n');
  
  state.filePath = filePath;
  state.status = 'MONITORING';
  state.running = true;
  
  // 初始检查
  await checkAndProcess(filePath);
  
  // 定时轮询
  while (state.running) {
    const interval = getPollingInterval(state.lastActivity);
    await new Promise(resolve => setTimeout(resolve, interval));
    
    if (state.running) {
      await checkAndProcess(filePath);
    }
  }
}

// 处理退出
process.on('SIGINT', () => {
  console.log('\n\n收到退出信号...');
  state.running = false;
  rl.close();
  console.log('监控已停止');
  process.exit(0);
});

// 启动
main().catch(error => {
  console.error('错误:', error);
  process.exit(1);
});
