/**
 * ============================================================================
 * E2E 测试工具
 * ============================================================================
 * 
 * 提供 E2E 测试所需的工具函数和 mock 数据
 */

import { vi } from 'vitest';
import type { MergedContext, SlackMessage, LocalInput } from '../../src/ai/provider.js';

/**
 * E2E 测试环境配置
 */
export const E2EConfig = {
  testChannel: '#incidents-e2e',
  testUser: 'U_TEST_USER',
  testBotUser: 'U_TEST_BOT',
  defaultTimeout: 30000,
};

/**
 * Mock Slack 消息工厂
 */
export function createSlackMessage(
  overrides?: Partial<SlackMessage>
): SlackMessage {
  return {
    ts: String(Date.now() / 1000),
    user: E2EConfig.testUser,
    text: 'Test message',
    thread_ts: undefined,
    ...overrides,
  };
}

/**
 * Mock 本地输入工厂
 */
export function createLocalInput(
  overrides?: Partial<LocalInput>
): LocalInput {
  return {
    text: 'Test local input',
    timestamp: Date.now(),
    type: 'SUPPLEMENT',
    ...overrides,
  };
}

/**
 * Mock 上下文工厂
 */
export function createMergedContext(
  overrides?: Partial<MergedContext>
): MergedContext {
  return {
    slackMessages: [],
    localInputs: [],
    timeline: [],
    metadata: {
      channel: E2EConfig.testChannel,
      participants: [E2EConfig.testUser],
      startTime: new Date(),
    },
    ...overrides,
  };
}

/**
 * E2E 测试场景构建器
 */
export class E2EScenarioBuilder {
  private messages: SlackMessage[] = [];
  private localInputs: LocalInput[] = [];
  private channel: string = E2EConfig.testChannel;

  /**
   * 添加 Slack 消息
   */
  withSlackMessage(text: string, user?: string): E2EScenarioBuilder {
    this.messages.push(createSlackMessage({
      text,
      user: user || E2EConfig.testUser,
    }));
    return this;
  }

  /**
   * 添加本地输入
   */
  withLocalInput(text: string, type?: LocalInput['type']): E2EScenarioBuilder {
    this.localInputs.push(createLocalInput({
      text,
      type: type || 'SUPPLEMENT',
    }));
    return this;
  }

  /**
   * 设置频道
   */
  withChannel(channel: string): E2EScenarioBuilder {
    this.channel = channel;
    return this;
  }

  /**
   * 构建场景
   */
  build(): { messages: SlackMessage[]; localInputs: LocalInput[]; channel: string } {
    return {
      messages: this.messages,
      localInputs: this.localInputs,
      channel: this.channel,
    };
  }

  /**
   * 构建上下文
   */
  buildContext(): MergedContext {
    const { messages, localInputs, channel } = this.build();
    
    const timeline = [
      ...messages.map((m): any => ({
        ts: m.ts,
        type: 'SLACK_MESSAGE' as const,
        content: m.text,
        source: 'SLACK' as const,
        user: m.user,
      })),
      ...localInputs.map((i): any => ({
        ts: String(i.timestamp),
        type: 'LOCAL_INPUT' as const,
        content: i.text,
        source: 'LOCAL' as const,
      })),
    ].sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

    return {
      slackMessages: messages,
      localInputs,
      timeline,
      metadata: {
        channel,
        participants: Array.from(new Set([...messages.map(m => m.user)])),
        startTime: new Date(parseFloat(timeline[0]?.ts || '0') * 1000),
      },
    };
  }
}

/**
 * 创建 E2E 场景构建器
 */
export function createScenario(): E2EScenarioBuilder {
  return new E2EScenarioBuilder();
}

/**
 * Mock MCP Client
 */
export function createMockMCPClient() {
  const callTool = vi.fn();
  const initialize = vi.fn();
  const close = vi.fn();

  return {
    callTool,
    initialize,
    close,
    // 预设响应
    mockResponse: (tool: string, response: any) => {
      callTool
        .mockImplementationOnce((server: string, toolName: string) => {
          if (toolName === tool) {
            return Promise.resolve({
              content: [{ type: 'text', text: JSON.stringify(response) }],
            });
          }
          return Promise.resolve({ content: [{ type: 'text', text: '{}' }] });
        });
    },
  };
}

/**
 * 等待条件成立
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (true) {
    const result = await Promise.resolve(condition());
    if (result) return;
    
    if (Date.now() - startTime > timeout) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * E2E 测试报告
 */
export interface E2ETestReport {
  scenario: string;
  startTime: number;
  endTime: number;
  steps: Array<{
    name: string;
    duration: number;
    success: boolean;
    error?: string;
  }>;
  success: boolean;
}

/**
 * 创建测试报告
 */
export function createTestReport(scenario: string): E2ETestReport {
  return {
    scenario,
    startTime: Date.now(),
    endTime: 0,
    steps: [],
    success: false,
  };
}
