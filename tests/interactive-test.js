#!/usr/bin/env node
/**
 * 交互式测试脚本
 * 
 * 让你亲自体验完整的事件响应流程
 * 
 * 运行：node tests/interactive-test.js
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const TEST_DIR = path.join(process.cwd(), 'data', 'interactive-test');
const STATE_DIR = path.join(process.cwd(), 'data', 'states');
const LOG_DIR = path.join(process.cwd(), 'logs');

// 确保目录存在
[TEST_DIR, STATE_DIR, LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const INCIDENT_FILE = path.join(TEST_DIR, 'incident-channel.txt');
const OUTPUT_FILE = path.join(TEST_DIR, 'bot-output.txt');
const LOG_FILE = path.join(LOG_DIR, 'api-service.log');

// 导入工具
const toolsPath = path.join(process.cwd(), 'tools', 'incident-monitor.js');
const tools = await import(toolsPath);

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 工具函数
function printHeader(text) {
  console.log('\n' + '█'.repeat(70));
  console.log(`█  ${text}`);
  console.log('█'.repeat(70) + '\n');
}

function printSection(text) {
  console.log('\n' + '═'.repeat(70));
  console.log(text);
  console.log('═'.repeat(70) + '\n');
}

function printAI(text) {
  console.log('\n🤖 AI:');
  console.log('─'.repeat(70));
  console.log(text);
  console.log('─'.repeat(70) + '\n');
}

function printTeammate(text) {
  console.log('\n👤 队友:');
  console.log('─'.repeat(70));
  console.log(text);
  console.log('─'.repeat(70) + '\n');
}

function prompt(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 模拟数据
const mockLogContent = `
2026-03-31 14:25:00 ERROR [payment-service] POST /api/payment/process - 500 Internal Server Error
  Trace: Database connection timeout
  Request ID: req-001
  User ID: user-12345
  Amount: $299.99

2026-03-31 14:26:15 ERROR [user-service] GET /api/users/profile - 500 Internal Server Error
  Trace: Redis connection refused
  Request ID: req-002
  User ID: user-67890

2026-03-31 14:28:30 ERROR [payment-service] POST /api/payment/process - 500 Internal Server Error
  Trace: Database connection timeout
  Request ID: req-003
  User ID: user-11111
  Amount: $149.99

2026-03-31 14:30:00 ERROR [payment-service] POST /api/payment/process - 500 Internal Server Error
  Trace: Database connection timeout
  Request ID: req-004
  User ID: user-22222
  Amount: $599.99
`;

// 清理旧数据
function resetTest() {
  [INCIDENT_FILE, OUTPUT_FILE, LOG_FILE].forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
  const stateFile = path.join(STATE_DIR, 'interactive-session.json');
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
}

function writeToFile(filePath, content) {
  fs.appendFileSync(filePath, content + '\n', 'utf-8');
}

// 主测试流程
async function runInteractiveTest() {
  printHeader('交互式测试：500 错误事件响应');
  
  console.log('这是一个交互式测试，你将亲自体验完整的事件响应流程。');
  console.log('在每个步骤，你可以：');
  console.log('  - 输入数字选择预设选项');
  console.log('  - 输入自定义文本');
  console.log('  - 输入 "quit" 退出测试');
  console.log('');
  console.log('按 Enter 开始...');
  await prompt('> ');
  
  resetTest();
  
  // ========== 步骤 1: 初始事件报告 ==========
  printSection('步骤 1: 初始事件报告');
  
  console.log('现在你是 oncall 工程师，收到了事件报告。');
  console.log('请输入事件报告内容（或直接按 Enter 使用预设）：');
  const userInput1 = await prompt('> ');
  
  const initialMessage = userInput1 || 'API 服务返回 500 错误！有人看到了吗？';
  writeToFile(INCIDENT_FILE, initialMessage);
  
  printTeammate(initialMessage);
  
  // AI 分析
  const messages = [initialMessage];
  const analysis = tools.analyze_messages(messages);
  
  printAI(`📊 分析结果:
- 状态：${analysis.status}
- 缺失信息：${analysis.missingInfo.join(', ')}
- 建议：${analysis.suggestions.join(', ')}

💡 需要追问具体信息。`);
  
  await sleep(1000);
  
  // ========== 步骤 2: AI 追问 ==========
  printSection('步骤 2: AI 追问');
  
  const questions = `请问以下信息以便准确调查：

1. 具体是哪个服务的 500 错误？
   - payment-service (支付服务)
   - user-service (用户服务)
   - notification-service (通知服务)
   - 其他服务

2. 具体的 API 端点是什么？

3. 错误从什么时候开始？大概多久发生一次？`;
  
  printAI(questions);
  writeToFile(OUTPUT_FILE, questions);
  
  await tools.save_state('interactive-session', {
    status: 'WAITING_INFO',
    lastReadIndex: 1,
    messageCount: 1,
  });
  
  // 等待用户输入
  console.log('现在请扮演队友回复（或直接按 Enter 使用预设）：');
  const userInput2 = await prompt('> ');
  
  const teammateReply1 = userInput2 || '是 payment-service 的 /api/payment/process 端点。从 14:25 开始，大概每 2-3 分钟发生一次。';
  writeToFile(INCIDENT_FILE, teammateReply1);
  
  printTeammate(teammateReply1);
  
  await sleep(1000);
  
  // ========== 步骤 3: AI 调查日志 ==========
  printSection('步骤 3: AI 调查日志');
  
  // 创建模拟日志
  fs.writeFileSync(LOG_FILE, mockLogContent);
  
  printAI(`📋 日志分析结果:

在 api-service.log 中发现 4 条 500 错误：

| 时间 | 服务 | 端点 | 错误原因 |
|------|------|------|----------|
| 14:25:00 | payment-service | POST /api/payment/process | Database connection timeout |
| 14:26:15 | user-service | GET /api/users/profile | Redis connection refused |
| 14:28:30 | payment-service | POST /api/payment/process | Database connection timeout |
| 14:30:00 | payment-service | POST /api/payment/process | Database connection timeout |

🔍 关键发现:
- payment-service 有 3 次 500 错误
- 错误原因都是 "Database connection timeout"
- 错误间隔约 2-3 分钟

💡 初步判断：数据库连接池可能已满。`);
  
  await sleep(1000);
  
  // ========== 步骤 4: AI 调查代码和 Commit ==========
  printSection('步骤 4: AI 调查代码和 Commit');
  
  printAI(`📋 代码分析:

问题位置：payment-service/src/controllers/payment.controller.js

\`\`\`js
async function processPayment(req, res) {
  const connection = await db.getConnection();  // ← 问题位置
  // ...
}
\`\`\`

📋 最近的 Commit:

| Commit | 作者 | 时间 | 变更 |
|--------|------|------|------|
| i7j8k9l | dev-wang | 03-29 | 重构数据库连接管理 |
| e4f5g6h | dev-li | 03-30 | 修复支付超时问题 |
| a1b2c3d | dev-zhang | 03-31 | 增加连接池大小到 50 |

⚠️ 可疑变更:
1. Commit i7j8k9l (03-29): 重构数据库连接管理
   - 可能引入了连接泄漏问题`);
  
  await sleep(1000);
  
  // ========== 步骤 5: AI 生成分析报告 ==========
  printSection('步骤 5: AI 生成分析报告');
  
  const analysisReport = `📊 事件分析报告

【问题概述】
- 服务：payment-service
- 端点：POST /api/payment/process
- 错误：500 Internal Server Error
- 原因：Database connection timeout

【影响范围】
- 时间：14:25 开始至今（约 10 分钟）
- 频率：每 2-3 分钟一次
- 已发生：3 次
- 预估影响用户：3 人

【根本原因】
数据库连接池已满，新请求无法获取连接导致超时。

【建议行动】
1. 立即：重启 payment-service 释放连接（临时方案）
2. 短期：检查 connection.js 中的连接释放逻辑
3. 长期：添加连接池监控告警`;
  
  printAI(analysisReport);
  
  console.log('请选择:');
  console.log('  [1] 确认发送报告');
  console.log('  [2] 修改报告');
  console.log('  [3] 取消');
  const choice1 = await prompt('> ');
  
  if (choice1 === '1' || !choice1) {
    printAI('✅ 报告已确认');
    writeToFile(OUTPUT_FILE, analysisReport);
  } else if (choice1 === '2') {
    console.log('请输入修改后的内容：');
    const modified = await prompt('> ');
    printAI(`✅ 报告已修改:\n${modified}`);
    writeToFile(OUTPUT_FILE, modified);
  }
  
  await tools.save_state('interactive-session', {
    status: 'READY_TO_REPLY',
    lastReadIndex: 2,
    messageCount: 2,
  });
  
  await sleep(1000);
  
  // ========== 步骤 6: 队友追问修复方案 ==========
  printSection('步骤 6: 队友追问修复方案');
  
  printTeammate('对，我们查了日志，确实是连接池的问题。但如果是这个问题，那要怎么修呢？我们需要具体的修复方案。');
  
  writeToFile(INCIDENT_FILE, teammateReply1 + '\n对，我们查了日志，确实是连接池的问题。但如果是这个问题，那要怎么修呢？');
  
  await sleep(1000);
  
  // ========== 步骤 7: AI 提供修复方案 ==========
  printSection('步骤 7: AI 提供修复方案');
  
  const fixProposal = `🔧 修复方案

【立即行动】（5 分钟内）
1. 重启 payment-service 释放连接
   命令：kubectl rollout restart deployment/payment-service
   
2. 临时增加连接池大小到 100
   文件：config/database.js
   修改：pool.max = 100

【短期修复】（今天内）
1. 检查并修复连接泄漏

   问题代码 (src/db/connection.js):
   \`\`\`js
   // 问题：异常时未释放连接
   async function getConnection() {
     const conn = await pool.getConnection();
     return conn;
   }
   
   // 修复：
   async function getConnection() {
     const conn = await pool.getConnection();
     conn.on('error', () => conn.release());
     return conn;
   }
   \`\`\`

2. 添加连接释放的自动保护
   \`\`\`js
   async function processPayment(req, res) {
     const connection = await db.getConnection();
     try {
       // ... 处理逻辑
     } finally {
       await connection.release();  // 确保释放
     }
   }
   \`\`\`

【影响面分析】

当前影响:
- 受影响用户：约 3 人/10 分钟
- 失败请求：约 3 次
- 影响金额：约 $1049.97

如果不修复:
- 预计影响：18 人/小时
- 连接池会在 10-15 分钟内再次耗尽

修复后预期:
- 连接泄漏问题解决
- 连接池使用率恢复正常（< 50%）
- 500 错误率降至 0`;
  
  printAI(fixProposal);
  
  console.log('请选择:');
  console.log('  [1] 确认发送方案');
  console.log('  [2] 修改方案');
  console.log('  [3] 取消');
  const choice2 = await prompt('> ');
  
  if (choice2 === '1' || !choice2) {
    printAI('✅ 修复方案已确认');
    writeToFile(OUTPUT_FILE, fixProposal);
  }
  
  await tools.save_state('interactive-session', {
    status: 'INVESTIGATING',
    lastReadIndex: 3,
    messageCount: 3,
    fixProposalSent: true,
  });
  
  await sleep(1000);
  
  // ========== 步骤 8: 队友执行修复 ==========
  printSection('步骤 8: 队友执行修复');
  
  console.log('队友正在执行修复...');
  await sleep(1500);
  
  printTeammate('好的，我们明白了。现在开始执行修复：\n1. 已重启服务\n2. 正在修改代码\n3. 测试中...');
  
  writeToFile(INCIDENT_FILE, '修复执行中...');
  
  await sleep(1000);
  
  // ========== 步骤 9: 事件解决 ==========
  printSection('步骤 9: 事件解决');
  
  console.log('一段时间后...');
  await sleep(1500);
  
  const resolutionMessage = '已修复 [CLOSED]\n\n修复内容:\n1. 在 connection.js 中添加了错误处理\n2. 在 payment.controller.js 中添加了 finally 块\n3. 部署完成，观察 10 分钟无新错误';
  
  printTeammate(resolutionMessage);
  writeToFile(INCIDENT_FILE, resolutionMessage);
  
  await sleep(1000);
  
  // ========== 步骤 10: AI 检测结束标记 ==========
  printSection('步骤 10: AI 检测结束标记');
  
  const endCheck = tools.check_end(resolutionMessage);
  console.log(`🔍 结束标记检测：${endCheck.hasEndMarker ? '✅ 检测到' : '❌ 未检测到'}`);
  console.log(`   匹配关键词：${endCheck.matchedKeyword || '无'}`);
  
  await sleep(1000);
  
  // ========== 步骤 11: AI 生成事件总结 ==========
  printSection('步骤 11: AI 生成事件总结');
  
  const incidentSummary = `📋 事件总结报告

【事件信息】
- 事件 ID: INC-${new Date().toISOString().split('T')[0]}-001
- 开始时间：2026-03-31 14:25
- 结束时间：2026-03-31 14:45
- 持续时间：20 分钟
- 严重性：P2

【问题描述】
payment-service 的 /api/payment/process 端点返回 500 错误，
原因是数据库连接池已满，新请求无法获取连接。

【影响范围】
- 受影响用户：3 人
- 失败请求：3 次
- 影响金额：$1049.97
- 持续时间：20 分钟

【根本原因】
Commit i7j8k9l 重构时，异常处理逻辑不完整，
导致数据库连接未正确释放。

【修复方案】
1. 在 connection.js 中添加连接错误处理
2. 在 payment.controller.js 中添加 finally 块
3. 重启服务释放连接

【后续行动】
- [ ] 添加连接池监控告警（负责人：@dev-zhang, 截止：04-07）
- [ ] Code Review 检查清单更新（负责人：@tech-lead, 截止：04-07）

【经验教训】
1. 数据库连接等资源必须在 finally 块中释放
2. 连接池配置变更需要配合监控
3. 重构代码时需要全面的回归测试`;
  
  printAI(incidentSummary);
  writeToFile(OUTPUT_FILE, incidentSummary);
  
  await tools.save_state('interactive-session', {
    status: 'CLOSED',
    lastReadIndex: 4,
    messageCount: 4,
    closedAt: new Date().toISOString(),
    incidentId: `INC-${new Date().toISOString().split('T')[0]}-001`,
  });
  
  await sleep(1000);
  
  // ========== 测试完成 ==========
  printHeader('测试完成！');
  
  console.log(`
✅ 你已完成完整的事件响应流程测试！

测试覆盖:
✓ 初始事件报告
✓ AI 追问澄清
✓ 队友回复确认
✓ AI 调查日志
✓ AI 调查代码和 Commit
✓ AI 生成分析报告
✓ 队友追问修复方案
✓ AI 提供修复方案 + 影响面分析
✓ 队友执行修复
✓ 事件解决反馈
✓ AI 检测结束标记
✓ AI 生成事件总结

输出文件:
- 对话记录：${INCIDENT_FILE}
- AI 回复：${OUTPUT_FILE}
- 会话状态：${STATE_DIR}/interactive-session.json
`);
  
  const finalState = tools.get_state('interactive-session');
  console.log('\n📊 最终状态:');
  console.log(JSON.stringify(finalState.state, null, 2));
  
  rl.close();
}

// 运行测试
runInteractiveTest().catch(console.error);
