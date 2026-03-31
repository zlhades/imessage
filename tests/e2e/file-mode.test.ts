/**
 * ============================================================================
 * E2E 测试：File MCP Server 模式
 * ============================================================================
 *
 * 测试场景：
 * 1. 使用 File MCP Server 模拟 Slack 消息
 * 2. 机器人从文件读取消息
 * 3. AI 分析并生成回复
 * 4. 回复写入输出文件
 *
 * 此测试无需 Slack 即可运行，适用于：
 * - 本地开发
 * - CI/CD 测试
 * - 演示
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  readMessages,
  writeBotResponse,
  clearMessages,
  createSampleMessages,
  getNewMessages,
} from '../../src/file-mode.js';

// 测试用文件路径
const TEST_DATA_DIR = path.join(process.cwd(), 'data', 'test-e2e');
const TEST_MESSAGE_FILE = path.join(TEST_DATA_DIR, 'messages.jsonl');
const TEST_OUTPUT_FILE = path.join(TEST_DATA_DIR, 'output.jsonl');

/**
 * 确保测试目录存在
 */
function ensureTestDir() {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
}

/**
 * 清理测试文件
 */
function cleanupTestFiles() {
  if (fs.existsSync(TEST_MESSAGE_FILE)) {
    fs.unlinkSync(TEST_MESSAGE_FILE);
  }
  if (fs.existsSync(TEST_OUTPUT_FILE)) {
    fs.unlinkSync(TEST_OUTPUT_FILE);
  }
}

describe('E2E: File MCP Server', () => {
  beforeEach(() => {
    ensureTestDir();
    cleanupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  it('应该创建示例消息文件', () => {
    // 创建示例消息
    createSampleMessages(TEST_MESSAGE_FILE);

    // 验证文件已创建
    expect(fs.existsSync(TEST_MESSAGE_FILE)).toBe(true);

    // 验证消息内容
    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].text).toContain('API');
    expect(messages[0].user).toBeDefined();
    expect(messages[0].ts).toBeDefined();
  });

  it('应该读取和写入消息', () => {
    // 初始消息
    const initialMessages = [
      { ts: '1000000001', user: 'user1', text: 'Help! API is down!' },
      { ts: '1000000002', user: 'user2', text: 'Seeing the same issue' },
    ];

    // 写入消息
    initialMessages.forEach((m) => {
      const line = JSON.stringify(m) + '\n';
      fs.appendFileSync(TEST_MESSAGE_FILE, line);
    });

    // 读取验证
    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(2);
    expect(messages[0].text).toBe('Help! API is down!');
    expect(messages[1].text).toBe('Seeing the same issue');
  });

  it('应该检测新消息', () => {
    // 先写入一些消息
    createSampleMessages(TEST_MESSAGE_FILE);
    const initialMessages = readMessages(TEST_MESSAGE_FILE);
    const lastTs = initialMessages[initialMessages.length - 1].ts;

    // 等待一小段时间，然后添加新消息
    const newMessages = [
      { ts: String(parseFloat(lastTs) + 1), user: 'user3', text: 'New update: found the issue' },
    ];
    newMessages.forEach((m) => {
      const line = JSON.stringify(m) + '\n';
      fs.appendFileSync(TEST_MESSAGE_FILE, line);
    });

    // 检测新消息
    const newMsgs = getNewMessages(TEST_MESSAGE_FILE, lastTs);
    expect(newMsgs.length).toBe(1);
    expect(newMsgs[0].text).toContain('found the issue');
  });

  it('应该写入机器人回复', () => {
    // 写入回复
    const response = '根据分析，这个问题与最近的部署有关。建议检查部署日志。';
    writeBotResponse(TEST_OUTPUT_FILE, response);

    // 验证回复已写入
    const outputMessages = readMessages(TEST_OUTPUT_FILE);
    expect(outputMessages.length).toBe(1);
    expect(outputMessages[0].user).toBe('bot');
    expect(outputMessages[0].text).toBe(response);
  });

  it('应该清空消息文件', () => {
    // 先写入消息
    createSampleMessages(TEST_MESSAGE_FILE);
    expect(readMessages(TEST_MESSAGE_FILE).length).toBeGreaterThan(0);

    // 清空
    clearMessages(TEST_MESSAGE_FILE);

    // 验证已清空
    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(0);
  });

  it('应该处理线程回复', () => {
    const threadTs = '1000000000';

    // 写入线程回复
    writeBotResponse(TEST_OUTPUT_FILE, '这是线程回复', threadTs);

    // 验证
    const messages = readMessages(TEST_OUTPUT_FILE);
    expect(messages[0].thread_ts).toBe(threadTs);
  });

  it('应该处理多条消息的时间戳顺序', () => {
    const messages = [
      { ts: '1000000003', user: 'user1', text: 'Message 3' },
      { ts: '1000000001', user: 'user2', text: 'Message 1' },
      { ts: '1000000002', user: 'user3', text: 'Message 2' },
    ];

    // 乱序写入
    messages.forEach((m) => {
      const line = JSON.stringify(m) + '\n';
      fs.appendFileSync(TEST_MESSAGE_FILE, line);
    });

    // 读取应该保持写入顺序
    const readMsgs = readMessages(TEST_MESSAGE_FILE);
    expect(readMsgs[0].text).toBe('Message 3');
    expect(readMsgs[1].text).toBe('Message 1');
    expect(readMsgs[2].text).toBe('Message 2');
  });
});

describe('E2E: File 模式完整流程', () => {
  beforeEach(() => {
    ensureTestDir();
    cleanupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  it('应该模拟完整的事件响应流程', () => {
    // ========================================================================
    // 步骤 1: 用户报告问题
    // ========================================================================
    const userMessages = [
      { ts: String(Date.now() / 1000), user: 'user1', text: 'API 服务返回 500 错误！' },
      { ts: String(Date.now() / 1000 + 1), user: 'user2', text: '我也是，从 10 分钟前开始的' },
    ];

    userMessages.forEach((m) => {
      const line = JSON.stringify(m) + '\n';
      fs.appendFileSync(TEST_MESSAGE_FILE, line);
    });

    // ========================================================================
    // 步骤 2: 机器人读取消息
    // ========================================================================
    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(2);

    // ========================================================================
    // 步骤 3: 模拟 AI 分析并生成回复
    // ========================================================================
    const botResponse = '收到。正在调查 API 500 错误问题。请问：\n1. 哪个具体的 API 端点受影响？\n2. 错误率大概是多少？';

    // ========================================================================
    // 步骤 4: 机器人写入回复
    // ========================================================================
    writeBotResponse(TEST_OUTPUT_FILE, botResponse);

    // ========================================================================
    // 步骤 5: 验证回复
    // ========================================================================
    const outputMessages = readMessages(TEST_OUTPUT_FILE);
    expect(outputMessages.length).toBe(1);
    expect(outputMessages[0].user).toBe('bot');
    expect(outputMessages[0].text).toContain('调查');
    expect(outputMessages[0].text).toContain('API');

    // ========================================================================
    // 步骤 6: 用户补充信息
    // ========================================================================
    const followUpMessage = {
      ts: String(Date.now() / 1000 + 2),
      user: 'user1',
      text: '是 /api/payment 端点，错误率大约 80%',
    };
    const line = JSON.stringify(followUpMessage) + '\n';
    fs.appendFileSync(TEST_MESSAGE_FILE, line);

    // ========================================================================
    // 步骤 7: 机器人检测新消息
    // ========================================================================
    const lastTs = messages[messages.length - 1].ts;
    const newMessages = getNewMessages(TEST_MESSAGE_FILE, lastTs);
    expect(newMessages.length).toBe(1);
    expect(newMessages[0].text).toContain('/api/payment');

    // ========================================================================
    // 步骤 8: 机器人再次回复
    // ========================================================================
    const secondResponse = '感谢信息。正在检查 /api/payment 端点的部署日志和错误率指标...';
    writeBotResponse(TEST_OUTPUT_FILE, secondResponse, messages[0].ts);

    // ========================================================================
    // 步骤 9: 验证完整流程
    // ========================================================================
    const finalOutput = readMessages(TEST_OUTPUT_FILE);
    expect(finalOutput.length).toBe(2);
    expect(finalOutput[1].thread_ts).toBe(messages[0].ts); // 第二条是线程回复

    console.log('✅ E2E 测试通过：File 模式完整流程');
  });

  it('应该处理多轮对话', () => {
    const conversation = [
      { ts: '1000000001', user: 'user1', text: '数据库连接超时' },
      { ts: '1000000002', user: 'bot', text: '收到，正在调查...' },
      { ts: '1000000003', user: 'user1', text: '有人知道吗？' },
      { ts: '1000000004', user: 'bot', text: '正在检查数据库连接池状态' },
      { ts: '1000000005', user: 'user2', text: '我看看日志' },
      { ts: '1000000006', user: 'user2', text: '找到了，是连接池满了' },
      { ts: '1000000007', user: 'bot', text: '好的，建议增加连接池大小或检查慢查询' },
    ];

    // 写入对话
    conversation.forEach((m) => {
      const line = JSON.stringify(m) + '\n';
      fs.appendFileSync(TEST_MESSAGE_FILE, line);
    });

    // 读取验证
    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(7);

    // 验证 bot 消息数量
    const botMessages = messages.filter((m) => m.user === 'bot');
    expect(botMessages.length).toBe(3);

    // 验证用户消息数量
    const userMessages = messages.filter((m) => m.user !== 'bot');
    expect(userMessages.length).toBe(4);

    console.log('✅ E2E 测试通过：多轮对话');
  });
});

describe('E2E: File 模式边界情况', () => {
  beforeEach(() => {
    ensureTestDir();
    cleanupTestFiles();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  it('应该处理空文件', () => {
    // 创建空文件
    fs.writeFileSync(TEST_MESSAGE_FILE, '', 'utf-8');

    // 读取应该返回空数组
    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(0);
  });

  it('应该处理不存在的文件', () => {
    // 不创建文件，直接读取
    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(0);
  });

  it('应该处理 JSON 格式错误的行', () => {
    // 写入一些有效和无效的行
    fs.writeFileSync(TEST_MESSAGE_FILE, 'invalid json\n', 'utf-8');
    fs.appendFileSync(TEST_MESSAGE_FILE, '{"ts": "1000", "user": "u1", "text": "valid"}\n', 'utf-8');
    fs.appendFileSync(TEST_MESSAGE_FILE, 'another invalid\n', 'utf-8');

    // 读取时应该抛出异常（当前实现）
    expect(() => readMessages(TEST_MESSAGE_FILE)).toThrow();
  });

  it('应该处理特殊字符', () => {
    const specialMessage = {
      ts: '1000000001',
      user: 'user1',
      text: 'Error: <>&"\' 特殊字符！@#$%^&*()',
    };

    const line = JSON.stringify(specialMessage) + '\n';
    fs.appendFileSync(TEST_MESSAGE_FILE, line);

    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(1);
    expect(messages[0].text).toContain('特殊字符');
  });

  it('应该处理很长的消息', () => {
    const longMessage = {
      ts: '1000000001',
      user: 'user1',
      text: 'Error details: '.repeat(1000),
    };

    const line = JSON.stringify(longMessage) + '\n';
    fs.appendFileSync(TEST_MESSAGE_FILE, line);

    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(1);
    expect(messages[0].text.length).toBeGreaterThan(10000);
  });

  it('应该处理 Unicode 字符', () => {
    const unicodeMessage = {
      ts: '1000000001',
      user: 'user1',
      text: '你好 🎉 Привет שלום مرحبا',
    };

    const line = JSON.stringify(unicodeMessage) + '\n';
    fs.appendFileSync(TEST_MESSAGE_FILE, line);

    const messages = readMessages(TEST_MESSAGE_FILE);
    expect(messages.length).toBe(1);
    expect(messages[0].text).toContain('🎉');
  });
});
