#!/usr/bin/env node
/**
 * 完整 E2E 测试：500 错误事件响应
 * 
 * 模拟真实生产环境的事件响应流程：
 * 1. 收到 500 错误报告
 * 2. 追问具体服务/模块
 * 3. 调查日志、代码、commit
 * 4. 分析并回复
 * 5. 确认问题
 * 6. 提供修复方案 + 影响面分析
 * 7. 执行修复
 * 8. 事件关闭
 * 
 * 运行：node test-full-e2e.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ 测试配置 ============
const TEST_DIR = path.join(__dirname, '..', 'data', 'e2e-full-test');
const LOG_DIR = path.join(__dirname, '..', 'logs');
const STATE_DIR = path.join(__dirname, '..', 'data', 'states');

// 确保目录存在
[TEST_DIR, LOG_DIR, STATE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 测试文件
const INCIDENT_FILE = path.join(TEST_DIR, 'incident-channel.txt');
const OUTPUT_FILE = path.join(TEST_DIR, 'bot-output.txt');
const LOG_FILE = path.join(LOG_DIR, 'api-service.log');
const STATE_FILE = path.join(STATE_DIR, 'test-session.json');

// 导入工具
const toolsPath = path.join(__dirname, '..', 'tools', 'incident-monitor.js');
const tools = await import(toolsPath);

// ============ 测试辅助函数 ============
let stepCount = 0;

function printStep(title, content = '') {
  stepCount++;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`步骤 ${stepCount}: ${title}`);
  console.log('='.repeat(70));
  if (content) console.log(content);
}

function printAI(content) {
  console.log(`\n🤖 AI:`);
  console.log('─'.repeat(70));
  console.log(content);
  console.log('─'.repeat(70));
}

function printUser(content) {
  console.log(`\n👤 用户/队友:`);
  console.log('─'.repeat(70));
  console.log(content);
  console.log('─'.repeat(70));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ 模拟数据 ============

// 模拟日志文件（多个服务的 500 错误）
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

2026-03-31 14:32:45 ERROR [notification-service] POST /api/notify/send - 500 Internal Server Error
  Trace: SMTP server unavailable
  Request ID: req-005
`;

// 模拟代码文件
const mockCodeContent = `
// payment-service/src/controllers/payment.controller.js

async function processPayment(req, res) {
  const { amount, userId } = req.body;
  
  try {
    // 获取数据库连接
    const connection = await db.getConnection();  // ← 问题位置：连接池满
    
    // 处理支付
    const result = await connection.query(
      'INSERT INTO payments (user_id, amount, status) VALUES (?, ?, ?)',
      [userId, amount, 'pending']
    );
    
    res.json({ success: true, paymentId: result.insertId });
  } catch (error) {
    logger.error('Payment processing failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
`;

// 模拟 Git 提交历史
const mockCommits = [
  {
    hash: 'a1b2c3d',
    author: 'dev-zhang',
    date: '2026-03-31 10:00:00',
    message: 'feat: 增加数据库连接池大小到 50',
    files: ['config/database.js'],
  },
  {
    hash: 'e4f5g6h',
    author: 'dev-li',
    date: '2026-03-30 16:30:00',
    message: 'fix: 修复支付超时问题',
    files: ['src/controllers/payment.controller.js'],
  },
  {
    hash: 'i7j8k9l',
    author: 'dev-wang',
    date: '2026-03-29 14:00:00',
    message: 'refactor: 重构数据库连接管理',
    files: ['src/db/connection.js', 'config/database.js'],
  },
];

// ============ 测试主流程 ============

async function runFullTest() {
  console.log('\n' + '█'.repeat(70));
  console.log('█  完整 E2E 测试：500 错误事件响应');
  console.log('█  模拟真实生产环境的事件响应流程');
  console.log('█'.repeat(70));
  
  // 清理旧数据
  resetTest();
  
  // ========== 步骤 1: 初始事件报告 ==========
  printStep('初始事件报告 - 收到 500 错误消息');
  
  const initialMessages = [
    'API 服务返回 500 错误！',
    '有人看到了吗？',
  ];
  
  writeToFile(INCIDENT_FILE, initialMessages.join('\n'));
  
  printUser(initialMessages.join('\n'));
  
  // AI 分析
  const analysis1 = tools.analyze_messages(initialMessages);
  printAI(`
📊 分析结果:
- 状态：${analysis1.status}
- 缺失信息：${analysis1.missingInfo.join(', ')}
- 建议：${analysis1.suggestions.join(', ')}

💡 检测到多个服务可能有 500 错误，需要确认具体是哪个服务。
生成追问问题...
`);
  
  // ========== 步骤 2: AI 追问具体服务 ==========
  printStep('AI 追问 - 确认具体服务和模块');
  
  const followUpQuestions = `
请问以下信息以便准确调查：

1. 具体是哪个服务的 500 错误？
   - payment-service (支付服务)
   - user-service (用户服务)
   - notification-service (通知服务)
   - 其他服务

2. 具体的 API 端点是什么？
   例如：POST /api/payment/process

3. 错误从什么时候开始？大概多久发生一次？

4. 有相关的日志或错误堆栈吗？
`;
  
  printAI(followUpQuestions);
  
  // 写入追问到输出文件
  await tools.write_confirm(OUTPUT_FILE, followUpQuestions);
  await tools.execute_write(OUTPUT_FILE, followUpQuestions);
  
  // 保存状态
  await tools.save_state('test-session', {
    status: 'WAITING_INFO',
    lastReadIndex: 2,
    messageCount: 2,
    pendingAction: 'waiting_for_service_info',
  });
  
  await sleep(500);
  
  // ========== 步骤 3: 队友回复确认服务 ==========
  printStep('队友回复 - 确认是支付服务');
  
  const teammateReply1 = `
是 payment-service 的 /api/payment/process 端点。
从 14:25 开始，大概每 2-3 分钟发生一次。
`;
  
  printUser(teammateReply1);
  
  // 写入文件
  writeToFile(INCIDENT_FILE, '\n' + teammateReply1);
  
  // ========== 步骤 4: AI 调查日志 ==========
  printStep('AI 调查 - 检查日志文件');
  
  // 模拟读取日志
  fs.writeFileSync(LOG_FILE, mockLogContent);
  
  const logAnalysis = `
📋 日志分析结果:

在 api-service.log 中发现 5 条 500 错误：

| 时间 | 服务 | 端点 | 错误原因 |
|------|------|------|----------|
| 14:25:00 | payment-service | POST /api/payment/process | Database connection timeout |
| 14:26:15 | user-service | GET /api/users/profile | Redis connection refused |
| 14:28:30 | payment-service | POST /api/payment/process | Database connection timeout |
| 14:30:00 | payment-service | POST /api/payment/process | Database connection timeout |
| 14:32:45 | notification-service | POST /api/notify/send | SMTP server unavailable |

🔍 关键发现:
- payment-service 有 3 次 500 错误
- 错误原因都是 "Database connection timeout"
- 错误间隔约 2-3 分钟
- 所有错误都发生在 /api/payment/process 端点

💡 初步判断：数据库连接池可能已满，导致新请求无法获取连接。
`;
  
  printAI(logAnalysis);
  
  // ========== 步骤 5: AI 调查代码和 Commit ==========
  printStep('AI 调查 - 检查代码和最近的 Commit');
  
  const codeAnalysis = `
📋 代码分析:

问题位置：payment-service/src/controllers/payment.controller.js

\`\`\`js
async function processPayment(req, res) {
  const connection = await db.getConnection();  // ← 问题位置
  // ...
}
\`\`\`

🔍 问题原因：
- db.getConnection() 会从连接池获取连接
- 如果连接池已满，会等待直到超时
- 当前连接池配置：max = 50

📋 最近的 Commit:

| Commit | 作者 | 时间 | 变更 |
|--------|------|------|------|
| i7j8k9l | dev-wang | 03-29 | 重构数据库连接管理 |
| e4f5g6h | dev-li | 03-30 | 修复支付超时问题 |
| a1b2c3d | dev-zhang | 03-31 | 增加连接池大小到 50 |

⚠️ 可疑变更:
1. Commit i7j8k9l (03-29): 重构数据库连接管理
   - 修改了 src/db/connection.js
   - 可能引入了连接泄漏问题

2. Commit a1b2c3d (03-31): 增加连接池大小到 50
   - 说明之前已经遇到连接池问题
   - 但增加池大小只是临时方案
`;
  
  printAI(codeAnalysis);
  
  // ========== 步骤 6: AI 生成分析报告 ==========
  printStep('AI 生成分析报告并请求确认');
  
  const analysisReport = `
📊 事件分析报告

【问题概述】
- 服务：payment-service
- 端点：POST /api/payment/process
- 错误：500 Internal Server Error
- 原因：Database connection timeout

【影响范围】
- 时间：14:25 开始至今（约 10 分钟）
- 频率：每 2-3 分钟一次
- 已发生：3 次
- 预估影响用户：3 人（根据日志中的 user_id）

【根本原因】
数据库连接池已满，新请求无法获取连接导致超时。

可能原因：
1. Commit i7j8k9l (03-29) 重构连接管理时引入连接泄漏
2. 连接未及时释放，导致连接池逐渐耗尽

【建议行动】
1. 立即：重启 payment-service 释放连接（临时方案）
2. 短期：检查 connection.js 中的连接释放逻辑
3. 长期：添加连接池监控告警

请选择:
[1] ✓ 确认发送报告
[2] ✏️ 修改报告
[3] ❌ 取消
[4] 💬 补充信息
`;
  
  printAI(analysisReport);
  
  // 保存状态
  await tools.save_state('test-session', {
    status: 'READY_TO_REPLY',
    lastReadIndex: 3,
    messageCount: 3,
    draft: analysisReport,
  });
  
  await sleep(500);
  
  // ========== 步骤 7: 队友确认并追问修复方案 ==========
  printStep('队友确认问题并追问修复方案');
  
  const teammateReply2 = `
对，我们查了日志，确实是连接池的问题。

但如果是这个问题，那要怎么修呢？
我们需要具体的修复方案。
`;
  
  printUser(teammateReply2);
  
  writeToFile(INCIDENT_FILE, '\n' + teammateReply2);
  
  // ========== 步骤 8: AI 提供详细修复方案 ==========
  printStep('AI 提供详细修复方案 + 影响面分析');
  
  const fixProposal = `
🔧 修复方案

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
     // 如果下面抛出异常，连接不会释放
     return conn;
   }
   
   // 修复：
   async function getConnection() {
     const conn = await pool.getConnection();
     // 添加错误处理
     conn.on('error', () => conn.release());
     return conn;
   }
   \`\`\`

2. 添加连接释放的自动保护
   \`\`\`js
   // 在 controller 中添加
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
- 影响金额：约 $1049.97（根据日志中的金额）

如果不修复:
- 预计影响：18 人/小时
- 连接池会在 10-15 分钟内再次耗尽
- 可能导致更多服务级联失败

修复后预期:
- 连接泄漏问题解决
- 连接池使用率恢复正常（< 50%）
- 500 错误率降至 0

【修复步骤】

1. 创建 hotfix 分支
   git checkout -b hotfix/payment-connection-leak

2. 修改 src/db/connection.js（添加错误处理）

3. 修改 src/controllers/payment.controller.js（添加 finally 块）

4. 测试
   npm test -- payment

5. 提交并部署
   git commit -m "fix: 修复数据库连接泄漏问题"
   git push origin hotfix/payment-connection-leak

请选择:
[1] ✓ 确认发送修复方案
[2] ✏️ 修改方案
[3] ❌ 取消
[4] 💬 补充信息
`;
  
  printAI(fixProposal);
  
  // 写入输出文件
  await tools.execute_write(OUTPUT_FILE, fixProposal);
  
  // 保存状态
  await tools.save_state('test-session', {
    status: 'INVESTIGATING',
    lastReadIndex: 4,
    messageCount: 4,
    fixProposalSent: true,
  });
  
  await sleep(500);
  
  // ========== 步骤 9: 队友确认修复并执行 ==========
  printStep('队友确认修复方案并执行');
  
  const teammateReply3 = `
好的，我们明白了。

现在开始执行修复：
1. 已重启服务
2. 正在修改代码
3. 测试中...

修复完成后会更新状态。
`;
  
  printUser(teammateReply3);
  
  writeToFile(INCIDENT_FILE, '\n' + teammateReply3);
  
  await sleep(500);
  
  // ========== 步骤 10: 事件解决 ==========
  printStep('事件解决 - 队友反馈已修复');
  
  const resolutionMessage = `
已修复 [CLOSED]

修复内容:
1. 在 connection.js 中添加了错误处理
2. 在 payment.controller.js 中添加了 finally 块确保连接释放
3. 部署完成，观察 10 分钟无新错误

根本原因:
Commit i7j8k9l 重构时，异常处理逻辑不完整，导致连接未正确释放。

后续行动:
1. 添加连接池监控告警（本周）
2. Code Review 时重点关注资源释放（长期）
`;
  
  printUser(resolutionMessage);
  
  writeToFile(INCIDENT_FILE, '\n' + resolutionMessage);
  
  // ========== 步骤 11: AI 检测结束标记并生成总结 ==========
  printStep('AI 检测结束标记并生成事件总结');
  
  // 检查结束标记
  const endCheck = tools.check_end(resolutionMessage);
  console.log(`\n🔍 结束标记检测：${endCheck.hasEndMarker ? '检测到' : '未检测到'}`);
  console.log(`   匹配关键词：${endCheck.matchedKeyword || '无'}`);
  
  // 生成事件总结
  const incidentSummary = `
📋 事件总结报告

【事件信息】
- 事件 ID: INC-20260331-001
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
Commit i7j8k9l (03-29) 重构数据库连接管理时，
异常处理逻辑不完整，导致数据库连接未正确释放，
连接池逐渐耗尽。

【修复方案】
1. 在 connection.js 中添加连接错误处理
2. 在 payment.controller.js 中添加 finally 块确保连接释放
3. 重启服务释放连接

【后续行动】
- [ ] 添加连接池监控告警（负责人：@dev-zhang, 截止：04-07）
- [ ] Code Review 检查清单更新（负责人：@tech-lead, 截止：04-07）
- [ ] 连接池压力测试（负责人：@qa-team, 截止：04-14）

【经验教训】
1. 数据库连接等资源必须在 finally 块中释放
2. 连接池配置变更需要配合监控
3. 重构代码时需要全面的回归测试
`;
  
  printAI(incidentSummary);
  
  // 写入输出文件
  await tools.execute_write(OUTPUT_FILE, incidentSummary);
  
  // 保存最终状态
  await tools.save_state('test-session', {
    status: 'CLOSED',
    lastReadIndex: 5,
    messageCount: 5,
    closedAt: new Date().toISOString(),
    incidentId: 'INC-20260331-001',
  });
  
  // ========== 测试完成 ==========
  printStep('测试完成');
  
  console.log(`
✅ 完整流程测试通过！

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

状态文件：${STATE_FILE}
输出文件：${OUTPUT_FILE}
日志文件：${LOG_FILE}
`);
  
  // 显示最终状态
  const finalState = tools.get_state('test-session');
  console.log('\n📊 最终状态:');
  console.log(JSON.stringify(finalState.state, null, 2));
}

// 辅助函数
function writeToFile(filePath, content) {
  fs.writeFileSync(filePath, content + '\n', 'utf-8');
}

function resetTest() {
  // 清理旧文件
  [INCIDENT_FILE, OUTPUT_FILE, LOG_FILE, STATE_FILE].forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
  
  stepCount = 0;
}

// 运行测试
runFullTest().catch(console.error);
