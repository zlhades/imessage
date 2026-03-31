/**
 * ============================================================================
 * Approval Gateway 单元测试
 * ============================================================================
 * 
 * 测试内容:
 * - 草稿准备
 * - 用户确认流程
 * - 第二次 Pull 检查
 * - 发送逻辑
 * - 取消和修改
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getApprovalGateway,
  formatDraftForDisplay,
  parseUserAction,
} from '../../../src/approval/gateway.js';
import type { DraftResponse } from '../../../src/approval/gateway.js';

// Mock MCP Client
vi.mock('../../../src/mcp/client.js', () => ({
  getMCPClient: vi.fn(() => ({
    callTool: vi.fn(),
  })),
}));

import { getMCPClient } from '../../../src/mcp/client.js';

describe('Approval Gateway', () => {
  let gateway: ReturnType<typeof getApprovalGateway>;
  let mockCallTool: any;

  beforeEach(() => {
    gateway = getApprovalGateway();
    mockCallTool = vi.fn();
    (getMCPClient as any).mockReturnValue({
      callTool: mockCallTool,
    });
    
    // 清除状态
    gateway.clearState();
    vi.clearAllMocks();
  });

  describe('prepareDraft', () => {
    it('应该创建草稿并进入等待确认状态', async () => {
      const draft = await gateway.prepareDraft({
        channel: '#incidents',
        text: 'Test response',
        pull_ts: '1234567890',
        context: {
          slackMessages: [],
          localInputs: [],
          timeline: [],
          metadata: {
            channel: '#incidents',
            participants: [],
          },
        },
      });

      expect(draft).toBeDefined();
      expect(draft.channel).toBe('#incidents');
      expect(draft.text).toBe('Test response');

      const state = gateway.getState();
      expect(state?.status).toBe('WAITING_CONFIRM');
    });
  });

  describe('confirm', () => {
    beforeEach(async () => {
      await gateway.prepareDraft({
        channel: '#incidents',
        text: 'Test response',
        pull_ts: '1234567890',
        context: {
          slackMessages: [],
          localInputs: [],
          timeline: [],
          metadata: { channel: '#incidents', participants: [] },
        },
      });
    });

    it('应该执行第二次 Pull 检查', async () => {
      mockCallTool.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            hasNewMessages: false,
            count: 0,
            messages: [],
          }),
        }],
      });

      const result = await gateway.confirm();

      expect(result.status).toBe('PULL_2_CHECK');
      expect(result.hasNewMessages).toBe(false);
      expect(mockCallTool).toHaveBeenCalledWith(
        'slack',
        'slack_check_new_messages',
        expect.objectContaining({
          channel: '#incidents',
          since_ts: '1234567890',
        })
      );
    });

    it('应该检测新消息', async () => {
      mockCallTool.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            hasNewMessages: true,
            count: 2,
            messages: [
              { ts: '1234567891', user: 'U1', text: 'New info!' },
            ],
          }),
        }],
      });

      const result = await gateway.confirm();

      expect(result.hasNewMessages).toBe(true);
      expect(result.newMessageCount).toBe(2);
    });

    it('没有草稿时应该抛出错误', async () => {
      gateway.clearState();
      await expect(gateway.confirm()).rejects.toThrow('No draft to confirm');
    });
  });

  describe('modify', () => {
    beforeEach(async () => {
      await gateway.prepareDraft({
        channel: '#incidents',
        text: 'Original text',
        pull_ts: '1234567890',
        context: {
          slackMessages: [],
          localInputs: [],
          timeline: [],
          metadata: { channel: '#incidents', participants: [] },
        },
      });
    });

    it('应该修改草稿文本', async () => {
      const result = await gateway.modify('Modified text');

      expect(result.status).toBe('WAITING_CONFIRM');
      expect(result.draft.text).toBe('Modified text');
    });

    it('应该更新生成时间', async () => {
      const originalTime = Date.now();
      await gateway.modify('Modified text');
      
      const state = gateway.getState();
      expect(state?.draft?.generated_at).toBeGreaterThan(originalTime - 1000);
    });

    it('没有草稿时应该抛出错误', async () => {
      gateway.clearState();
      await expect(gateway.modify('test')).rejects.toThrow('No draft to modify');
    });
  });

  describe('supplement', () => {
    beforeEach(async () => {
      await gateway.prepareDraft({
        channel: '#incidents',
        text: 'Test response',
        pull_ts: '1234567890',
        context: {
          slackMessages: [],
          localInputs: [],
          timeline: [],
          metadata: { channel: '#incidents', participants: [] },
        },
      });
    });

    it('应该添加本地输入并进入重新分析状态', async () => {
      const result = await gateway.supplement('Additional info from local');

      expect(result.status).toBe('REANALYZING');
      expect(result.localInput).toBe('Additional info from local');

      const state = gateway.getState();
      expect(state?.localInput?.text).toBe('Additional info from local');
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      await gateway.prepareDraft({
        channel: '#incidents',
        text: 'Test response',
        pull_ts: '1234567890',
        context: {
          slackMessages: [],
          localInputs: [],
          timeline: [],
          metadata: { channel: '#incidents', participants: [] },
        },
      });

      // 模拟第二次 Pull 通过
      mockCallTool.mockResolvedValueOnce({
        content: [{
          type: 'text',
          text: JSON.stringify({ hasNewMessages: false, count: 0 }),
        }],
      });
      await gateway.confirm();
    });

    it('应该发送消息到 Slack', async () => {
      mockCallTool.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            ok: true,
            ts: '1234567891',
            channel: 'C123',
          }),
        }],
      });

      const result = await gateway.send();

      expect(result.success).toBe(true);
      expect(result.ts).toBe('1234567891');
      expect(mockCallTool).toHaveBeenCalledWith(
        'slack',
        'slack_send_message',
        expect.objectContaining({
          channel: '#incidents',
          text: 'Test response',
        })
      );
    });

    it('应该处理发送失败', async () => {
      mockCallTool.mockRejectedValue(new Error('Send failed'));

      await expect(gateway.send()).rejects.toThrow('Send failed');

      // 状态应该恢复到等待确认
      const state = gateway.getState();
      expect(state?.status).toBe('WAITING_CONFIRM');
    });

    it('没有草稿时应该抛出错误', async () => {
      gateway.clearState();
      await expect(gateway.send()).rejects.toThrow('No draft to send');
    });
  });

  describe('cancel', () => {
    it('应该取消并清除状态', async () => {
      await gateway.prepareDraft({
        channel: '#incidents',
        text: 'Test',
        pull_ts: '1234567890',
        context: {
          slackMessages: [],
          localInputs: [],
          timeline: [],
          metadata: { channel: '#incidents', participants: [] },
        },
      });

      const result = await gateway.cancel();

      expect(result.status).toBe('CANCELLED');
      expect(gateway.getState()).toBeUndefined();
    });
  });
});

describe('工具函数', () => {
  describe('formatDraftForDisplay', () => {
    it('应该格式化草稿用于显示', () => {
      const draft: DraftResponse = {
        channel: '#incidents',
        text: 'Test message',
        generated_at: Date.now(),
        pull_ts: '1234567890',
      };

      const formatted = formatDraftForDisplay(draft);

      expect(formatted).toContain('📤 准备发送以下回复到 Slack');
      expect(formatted).toContain('#incidents');
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('✓ 确认发送');
    });

    it('应该包含线程信息', () => {
      const draft: DraftResponse = {
        channel: '#incidents',
        text: 'Test',
        thread_ts: '1234567890',
        generated_at: Date.now(),
        pull_ts: '1234567890',
      };

      const formatted = formatDraftForDisplay(draft);
      expect(formatted).toContain('线程：1234567890');
    });
  });

  describe('parseUserAction', () => {
    it('应该解析确认操作', () => {
      expect(parseUserAction('1').action).toBe('confirm');
    });

    it('应该解析修改操作', () => {
      expect(parseUserAction('2').action).toBe('modify');
    });

    it('应该解析调查操作', () => {
      expect(parseUserAction('3').action).toBe('investigate');
    });

    it('应该解析补充操作', () => {
      expect(parseUserAction('4').action).toBe('supplement');
    });

    it('应该解析取消操作', () => {
      expect(parseUserAction('5').action).toBe('cancel');
    });

    it('应该将其他输入视为补充', () => {
      const result = parseUserAction('Custom message');
      expect(result.action).toBe('supplement');
      expect(result.value).toBe('Custom message');
    });
  });
});
