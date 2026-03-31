/**
 * 测试全局设置
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.QWEN_API_KEY = 'test-key';
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_SIGNING_SECRET = 'test-secret';

// 全局 mock
import { vi } from 'vitest';

// Mock console.error 在测试中
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // 只在非测试模式下输出
  if (process.env.VERBOSE === 'true') {
    originalConsoleError(...args);
  }
};

// 全局测试工具
export const testUtils = {
  /**
   * 等待指定毫秒
   */
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  /**
   * 创建 mock Slack 消息
   */
  createMockSlackMessage: (overrides?: Partial<any>) => ({
    ts: '1234567890.123456',
    user: 'U123456',
    text: 'Test message',
    thread_ts: undefined,
    ...overrides,
  }),
  
  /**
   * 创建 mock 上下文
   */
  createMockContext: (overrides?: Partial<any>) => ({
    slackMessages: [],
    localInputs: [],
    timeline: [],
    metadata: {
      channel: '#incidents',
      participants: ['U123456'],
      startTime: new Date(),
    },
    ...overrides,
  }),
};
