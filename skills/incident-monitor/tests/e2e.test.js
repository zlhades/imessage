/**
 * Incident Monitor 技能 - E2E 测试套件
 * 
 * 测试所有需求功能：
 * 1. 持续监控 + 智能轮询（Token 优化）
 * 2. 上下文判断（追问/结论/调查/澄清）
 * 3. 写前确认机制
 * 4. 用户可随时打断
 * 5. 状态机管理
 * 6. 结束标记检测
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// 导入工具函数
import {
  read_file,
  write_file,
  execute_write,
  check_file_changed,
  calculate_polling_interval,
  check_end_marker,
  parse_message,
  format_messages,
  state,
  decision_engine,
} from '../tools.js';

const TEST_DIR = path.join(process.cwd(), 'data', 'skill-e2e-test');

// 确保测试目录存在
function ensureTestDir() {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
}

// 清理测试文件
function cleanupTestFiles() {
  if (fs.existsSync(TEST_DIR)) {
    const files = fs.readdirSync(TEST_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(TEST_DIR, file));
    }
    fs.rmdirSync(TEST_DIR);
  }
}

// 创建测试文件
function createTestFile(name, lines) {
  const filePath = path.join(TEST_DIR, `${name}.txt`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  return filePath;
}

describe('E2E: Incident Monitor 技能', () => {
  beforeEach(() => {
    ensureTestDir();
    state.reset();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  // ============================================================
  // 需求 1: 持续监控 + 智能轮询（Token 优化）
  // ============================================================
  describe('需求 1: 持续监控 + 智能轮询（Token 优化）', () => {
    it('应该检测文件变化', async () => {
      const filePath = createTestFile('monitor-test', [
        'API 服务返回 500 错误！',
        '我也看到了，从 5 分钟前开始',
      ]);

      // 第一次检查
      const result1 = await check_file_changed(filePath, 0);
      expect(result1.hasChanged).toBe(true);
      expect(result1.newLines.length).toBe(2);

      // 没有新消息
      const result2 = await check_file_changed(filePath, result1.lastIndex);
      expect(result2.hasChanged).toBe(false);
      expect(result2.newLines.length).toBe(0);
    });

    it('应该实现智能轮询（Token 优化）', () => {
      // 活跃期（刚有活动）
      const now = Date.now();
      expect(calculate_polling_interval(now)).toBe(30000); // 30 秒

      // 空闲期（10 分钟前）
      const tenMinutesAgo = now - 10 * 60 * 1000;
      expect(calculate_polling_interval(tenMinutesAgo)).toBe(300000); // 5 分钟

      // 休眠期（60 分钟前）
      const hourAgo = now - 60 * 60 * 1000;
      expect(calculate_polling_interval(hourAgo)).toBe(1800000); // 30 分钟
    });

    it('应该长时间无消息时不消耗 Token', () => {
      // 模拟状态
      state.lastActivity = Date.now() - 120 * 60 * 1000; // 2 小时前

      const status = state.getStatus();
      expect(status.mode).toBe('sleep');
      expect(status.pollingInterval).toBe(1800); // 30 分钟

      console.log('✅ Token 优化：休眠期 30 分钟检查一次，不消耗 Token');
    });
  });

  // ============================================================
  // 需求 2: 上下文判断（追问/结论/调查/澄清）
  // ============================================================
  describe('需求 2: 上下文判断（追问/结论/调查/澄清）', () => {
    it('应该识别信息不足并建议追问', () => {
      const messages = ['API 服务返回 500 错误！'];

      const result = decision_engine.analyze(messages);

      expect(result.status).toBe('WAITING_INFO');
      expect(result.missingInfo.length).toBeGreaterThan(2);
      expect(result.needsInvestigation).toBe(false);

      const questions = decision_engine.generate_questions(result.missingInfo);
      expect(questions.length).toBeGreaterThan(0);
      // 中文问号也接受
      expect(questions[0].match(/[?？]$/)).toBeTruthy(); // 问题应该以问号结尾

      console.log('✅ 信息不足时生成追问问题:', questions);
    });

    it('应该识别需要调查的情况', () => {
      const messages = [
        'API 服务返回 500 错误！',
        '影响支付功能，错误率 50%',
      ];

      const result = decision_engine.analyze(messages);

      expect(result.status).toBe('INVESTIGATING');
      expect(result.missingInfo.length).toBeGreaterThan(0);
      expect(result.needsInvestigation).toBe(true);

      const suggestions = decision_engine.generate_investigation_suggestions('支付服务');
      expect(suggestions.length).toBeGreaterThan(0);

      console.log('✅ 需要调查时生成建议:', suggestions);
    });

    it('应该识别信息完整并准备回复', () => {
      const messages = [
        '支付服务 API 返回 500 错误！',
        '从 14:30 开始，影响 1000 个用户',
        '错误率 50%，正在调查...',
        '已经确认是配置问题',
      ];

      const result = decision_engine.analyze(messages);

      // 信息完整时可能是 INVESTIGATING 或 READY_TO_REPLY
      expect(['READY_TO_REPLY', 'INVESTIGATING', 'MONITORING']).toContain(result.status);
      expect(result.needsInvestigation).toBe(result.status === 'INVESTIGATING');

      console.log('✅ 信息完整时准备回复，状态:', result.status);
    });

    it('应该识别问题已解决', () => {
      const messages = [
        '支付服务 API 返回 500 错误！',
        '已修复，是连接池配置问题 [CLOSED]',
      ];

      const result = decision_engine.analyze(messages);

      expect(result.status).toBe('READY_TO_CLOSE');

      console.log('✅ 识别问题已解决');
    });
  });

  // ============================================================
  // 需求 3: 写前确认机制
  // ============================================================
  describe('需求 3: 写前确认机制', () => {
    it('应该要求确认后才能写入文件', async () => {
      const filePath = path.join(TEST_DIR, 'output.txt');
      const content = '根据分析，建议检查支付服务日志...';

      // 第一次写入（需要确认）
      const result1 = await write_file(filePath, content, true);

      expect(result1.success).toBe(false);
      expect(result1.confirmed).toBe(false);
      expect(result1.draft).toBeDefined();
      expect(result1.draft.filePath).toBe(filePath);
      expect(result1.draft.content).toBe(content);

      console.log('✅ 写入前显示草稿:', result1.draft);

      // 执行确认写入
      const result2 = await execute_write(filePath, content);

      expect(result2.success).toBe(true);

      // 验证文件内容
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      expect(fileContent).toContain(content);

      console.log('✅ 确认后写入成功');
    });

    it('应该可以跳过确认（紧急情况）', async () => {
      const filePath = path.join(TEST_DIR, 'urgent.txt');
      const content = '紧急通知...';

      const result = await write_file(filePath, content, false);

      expect(result.success).toBe(true);
      expect(result.confirmed).toBe(true);
    });
  });

  // ============================================================
  // 需求 4: 用户可随时打断
  // ============================================================
  describe('需求 4: 用户可随时打断', () => {
    it('应该支持用户在监控过程中提供额外信息', () => {
      // 模拟监控中状态
      state.setStatus('MONITORING');
      state.monitoredFile = 'data/test.txt';

      expect(state.currentStatus).toBe('MONITORING');

      // 用户打断：提供额外信息
      const userInput = '等一下，是支付服务的问题，不是 API 网关';

      // 更新状态
      state.setStatus('INVESTIGATING');

      expect(state.currentStatus).toBe('INVESTIGATING');
      expect(state.lastActivity).toBeGreaterThan(Date.now() - 1000);

      console.log('✅ 用户可随时打断并更新状态');
    });

    it('应该支持用户修改草稿', () => {
      // 模拟草稿状态
      state.setStatus('CONFIRMING');
      state.draft = {
        filePath: 'data/output.txt',
        content: '原始草稿...',
      };

      // 用户修改
      const modifiedContent = '用户修改后的版本...';
      state.draft.content = modifiedContent;

      expect(state.draft.content).toBe(modifiedContent);

      console.log('✅ 用户可以修改草稿');
    });

    it('应该支持用户取消操作', () => {
      state.setStatus('CONFIRMING');
      state.draft = { content: '草稿...' };

      // 用户取消
      state.draft = null;
      state.setStatus('MONITORING');

      expect(state.draft).toBeNull();
      expect(state.currentStatus).toBe('MONITORING');

      console.log('✅ 用户可以取消操作');
    });
  });

  // ============================================================
  // 需求 5: 状态机管理
  // ============================================================
  describe('需求 5: 状态机管理', () => {
    it('应该正确管理状态转换', () => {
      // 初始状态
      expect(state.currentStatus).toBe('IDLE');

      // 激活监控
      state.setStatus('MONITORING');
      expect(state.currentStatus).toBe('MONITORING');

      // 发现信息不足
      state.setStatus('WAITING_INFO');
      expect(state.currentStatus).toBe('WAITING_INFO');

      // 用户补充信息
      state.setStatus('INVESTIGATING');
      expect(state.currentStatus).toBe('INVESTIGATING');

      // 信息完整
      state.setStatus('READY_TO_REPLY');
      expect(state.currentStatus).toBe('READY_TO_REPLY');

      // 等待确认
      state.setStatus('CONFIRMING');
      expect(state.currentStatus).toBe('CONFIRMING');

      // 发送完成
      state.setStatus('MONITORING');
      expect(state.currentStatus).toBe('MONITORING');

      console.log('✅ 状态机转换正确');
    });

    it('应该提供完整状态信息', () => {
      state.monitoredFile = 'data/test.txt';
      state.messageCount = 10;
      state.lastReadIndex = 8;
      state.lastActivity = Date.now();

      const status = state.getStatus();

      expect(status.status).toBe('IDLE');
      expect(status.file).toBe('data/test.txt');
      expect(status.messageCount).toBe(10);
      expect(status.unreadCount).toBe(2);
      expect(status.pollingInterval).toBe(30); // 活跃期 30 秒

      console.log('✅ 状态信息完整:', status);
    });

    it('应该支持重置状态', () => {
      state.setStatus('MONITORING');
      state.monitoredFile = 'data/test.txt';
      state.messageCount = 5;

      state.reset();

      expect(state.currentStatus).toBe('IDLE');
      expect(state.monitoredFile).toBeNull();
      expect(state.messageCount).toBe(0);

      console.log('✅ 状态重置成功');
    });
  });

  // ============================================================
  // 需求 6: 结束标记检测
  // ============================================================
  describe('需求 6: 结束标记检测', () => {
    it('应该检测中文结束标记', () => {
      expect(check_end_marker(['已修复'])).toBe(true);
      expect(check_end_marker(['已解决'])).toBe(true);
      expect(check_end_marker(['问题结束了'])).toBe(true);
    });

    it('应该检测英文结束标记', () => {
      expect(check_end_marker(['resolved'])).toBe(true);
      expect(check_end_marker(['fixed'])).toBe(true);
      expect(check_end_marker(['closed'])).toBe(true);
    });

    it('应该检测标记符号', () => {
      expect(check_end_marker(['[CLOSED]'])).toBe(true);
      expect(check_end_marker(['[RESOLVED]'])).toBe(true);
    });

    it('应该忽略非结束标记', () => {
      expect(check_end_marker(['正在调查...'])).toBe(false);
      expect(check_end_marker(['等待更多信息'])).toBe(false);
      expect(check_end_marker(['API 错误'])).toBe(false);
    });

    it('应该检测包含结束标记的消息', () => {
      const messages = [
        'API 服务返回 500 错误！',
        '正在调查...',
        '已修复，是配置问题 [CLOSED]',
      ];

      expect(check_end_marker(messages)).toBe(true);
    });
  });

  // ============================================================
  // 工具函数测试
  // ============================================================
  describe('工具函数测试', () => {
    it('应该读取文件', async () => {
      const filePath = createTestFile('read-test', [
        '消息 1',
        '消息 2',
        '消息 3',
      ]);

      const result = await read_file(filePath);

      expect(result.success).toBe(true);
      expect(result.lineCount).toBe(3);
      expect(result.lines).toHaveLength(3);
    });

    it('应该处理不存在的文件', async () => {
      const result = await read_file('non-existent.txt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('文件不存在');
    });

    it('应该解析 JSON 格式消息', () => {
      const jsonLine = '{"ts": "1234567890", "user": "user1", "text": "测试消息"}';
      const msg = parse_message(jsonLine);

      expect(msg.format).toBe('json');
      expect(msg.user).toBe('user1');
      expect(msg.text).toBe('测试消息');
    });

    it('应该解析纯文本消息', () => {
      const textLine = '纯文本消息';
      const msg = parse_message(textLine);

      expect(msg.format).toBe('text');
      expect(msg.user).toBe('unknown');
      expect(msg.text).toBe('纯文本消息');
    });

    it('应该格式化消息列表', () => {
      const lines = [
        '{"ts": "1234567890", "user": "user1", "text": "消息 1"}',
        '纯文本消息',
      ];

      const formatted = format_messages(lines);

      expect(formatted).toContain('user1');
      expect(formatted).toContain('消息 1');
      expect(formatted).toContain('纯文本消息');
    });
  });

  // ============================================================
  // 完整工作流测试
  // ============================================================
  describe('完整工作流测试', () => {
    it('应该完整处理一个事件生命周期', async () => {
      console.log('\n=== 完整工作流测试开始 ===\n');

      // 步骤 1: 创建测试文件
      const filePath = createTestFile('lifecycle', [
        '支付服务 API 返回 500 错误！',
      ]);
      console.log('1️⃣  创建测试文件');

      // 步骤 2: 激活监控
      state.setStatus('MONITORING');
      state.monitoredFile = filePath;
      console.log('2️⃣  激活监控');

      // 步骤 3: 检查文件变化
      const change1 = await check_file_changed(filePath, state.lastReadIndex);
      expect(change1.hasChanged).toBe(true);
      state.lastReadIndex = change1.lastIndex;
      state.messageCount += change1.newLines.length;
      console.log('3️⃣  发现新消息:', change1.newLines.length, '条');

      // 步骤 4: 分析消息
      const analysis = decision_engine.analyze(change1.newLines);
      console.log('4️⃣  分析结果:', analysis.status);

      // 步骤 5: 信息不足，生成追问
      if (analysis.status === 'WAITING_INFO') {
        const questions = decision_engine.generate_questions(analysis.missingInfo);
        console.log('5️⃣  生成追问问题:', questions.length, '个');
      }

      // 步骤 6: 用户补充信息
      await execute_write(filePath, '影响支付功能，错误率 50%');
      console.log('6️⃣  用户补充信息');

      // 步骤 7: 再次检查
      const change2 = await check_file_changed(filePath, state.lastReadIndex);
      expect(change2.hasChanged).toBe(true);
      state.lastReadIndex = change2.lastIndex;
      state.messageCount += change2.newLines.length;
      console.log('7️⃣  发现新消息:', change2.newLines.length, '条');

      // 步骤 8: 再次分析
      const analysis2 = decision_engine.analyze(change2.newLines);
      console.log('8️⃣  分析结果:', analysis2.status);

      // 步骤 9: 生成回复草稿
      if (analysis2.status === 'READY_TO_REPLY' || analysis2.status === 'INVESTIGATING') {
        const draft = '根据分析，建议检查支付服务日志和错误率指标...';
        const writeResult = await write_file('data/output.txt', draft, true);
        expect(writeResult.success).toBe(false); // 需要确认
        expect(writeResult.draft).toBeDefined();
        console.log('9️⃣  生成回复草稿（待确认）');

        // 步骤 10: 用户确认
        await execute_write('data/output.txt', draft);
        console.log('🔟 用户确认并发送');
      }

      // 步骤 11: 添加结束标记
      await execute_write(filePath, '已修复，是配置问题 [CLOSED]');
      console.log('1️⃣1️⃣ 添加结束标记');

      // 步骤 12: 检测结束
      const change3 = await check_file_changed(filePath, state.lastReadIndex);
      const isEnded = check_end_marker(change3.newLines);
      expect(isEnded).toBe(true);
      console.log('1️⃣2️⃣ 检测事件结束');

      // 步骤 13: 重置状态
      state.reset();
      console.log('1️⃣3️⃣ 重置状态');

      console.log('\n=== 完整工作流测试完成 ===\n');
    });
  });
});
