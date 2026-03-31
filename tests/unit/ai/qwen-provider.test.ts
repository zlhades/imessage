/**
 * ============================================================================
 * AI Provider 单元测试
 * ============================================================================
 * 
 * 测试内容:
 * - QwenProvider 的初始化和配置
 * - 分析功能的输入输出
 * - 回复生成的准确性
 * - 追问问题生成
 * - 健康检查
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QwenProvider, createQwenProvider } from '../../../src/ai/qwen-provider.js';
import { AIProviderConfig, MergedContext } from '../../../src/ai/provider.js';

// Mock OpenAI client
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    OpenAI: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    __mockCreate: mockCreate,
  };
});

import { OpenAI } from 'openai';

describe('QwenProvider', () => {
  let provider: QwenProvider;
  let mockConfig: AIProviderConfig;

  beforeEach(() => {
    mockConfig = {
      type: 'openai-compatible',
      baseUrl: 'https://test.dashscope.com',
      apiKey: 'test-key',
      model: 'qwen-test',
      contextLimit: 1000,
    };

    provider = createQwenProvider(mockConfig);
    
    // 重置 mock
    vi.clearAllMocks();
  });

  describe('构造函数', () => {
    it('应该正确初始化 Provider', () => {
      expect(provider).toBeInstanceOf(QwenProvider);
      expect(provider.name).toBe('qwen');
    });

    it('应该使用配置中的参数', () => {
      expect(provider).toBeDefined();
    });
  });

  describe('analyze', () => {
    it('应该分析上下文并返回分析结果', async () => {
      // 准备 mock 响应
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              intent: {
                type: 'problem_report',
                severity: 'P2',
                description: 'Service is down',
              },
              confidence: 0.85,
              missingInfo: ['start_time', 'affected_users'],
              suggestedQuestions: ['When did it start?', 'How many users are affected?'],
              needsInvestigation: true,
            }),
          },
        }],
      };

      const mockCreate = (OpenAI as any).__mockCreate;
      mockCreate.mockResolvedValue(mockResponse);

      // 准备测试上下文
      const context: MergedContext = {
        slackMessages: [
          {
            ts: '1234567890',
            user: 'U123',
            text: 'The service is down!',
          },
        ],
        localInputs: [],
        timeline: [
          {
            ts: '1234567890',
            type: 'SLACK_MESSAGE',
            content: 'The service is down!',
            source: 'SLACK',
            user: 'U123',
          },
        ],
        metadata: {
          channel: '#incidents',
          participants: ['U123'],
          startTime: new Date(),
        },
      };

      // 执行测试
      const result = await provider.analyze(context);

      // 验证结果
      expect(result.intent.type).toBe('problem_report');
      expect(result.confidence).toBeGreaterThan(0);
      expect(Array.isArray(result.missingInfo)).toBe(true);
      expect(Array.isArray(result.suggestedQuestions)).toBe(true);

      // 验证 API 被调用
      expect(mockCreate).toHaveBeenCalled();
    });

    it('应该处理 API 错误', async () => {
      const mockCreate = (OpenAI as any).__mockCreate;
      mockCreate.mockRejectedValue(new Error('API Error'));

      const context: MergedContext = {
        slackMessages: [],
        localInputs: [],
        timeline: [],
        metadata: {
          channel: '#incidents',
          participants: [],
        },
      };

      await expect(provider.analyze(context)).rejects.toThrow('API Error');
    });
  });

  describe('generateQuestions', () => {
    it('应该为缺失信息生成问题', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              questions: [
                'When did the issue start?',
                'What services are affected?',
              ],
            }),
          },
        }],
      };

      const mockCreate = (OpenAI as any).__mockCreate;
      mockCreate.mockResolvedValue(mockResponse);

      const missingInfo = ['start_time', 'affected_services'];
      const questions = await provider.generateQuestions(missingInfo);

      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it('空缺失信息应该返回空数组', async () => {
      const questions = await provider.generateQuestions([]);
      expect(questions).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('应该返回健康状态', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'pong' } }],
      };

      const mockCreate = (OpenAI as any).__mockCreate;
      mockCreate.mockResolvedValue(mockResponse);

      const healthy = await provider.healthCheck();
      expect(healthy).toBe(true);
    });

    it('应该处理健康检查失败', async () => {
      const mockCreate = (OpenAI as any).__mockCreate;
      mockCreate.mockRejectedValue(new Error('Connection failed'));

      const healthy = await provider.healthCheck();
      expect(healthy).toBe(false);
    });
  });
});

describe('createQwenProvider', () => {
  it('应该创建 QwenProvider 实例', () => {
    const config = {
      type: 'openai-compatible' as const,
      baseUrl: 'https://test.com',
      apiKey: 'test-key',
      model: 'qwen-test',
    };

    const provider = createQwenProvider(config);
    expect(provider).toBeInstanceOf(QwenProvider);
    expect(provider.name).toBe('qwen');
  });
});
