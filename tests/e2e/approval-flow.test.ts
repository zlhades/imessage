/**
 * ============================================================================
 * E2E 测试：发送前双重确认流程
 * ============================================================================
 * 
 * 测试场景:
 * 1. AI 生成回复草稿
 * 2. 显示草稿并等待用户确认
 * 3. 用户确认后进行第二次 Pull 检查
 * 4. 无新消息 → 发送
 * 5. 有新消息 → 重新分析
 * 
 * 预期结果:
 * - 草稿正确创建
 * - 第二次 Pull 检查生效
 * - 根据新消息决定是否发送
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getApprovalGateway,
  formatDraftForDisplay,
  parseUserAction,
} from '../../src/approval/gateway.js';
import { createMockMCPClient, createScenario } from './utils.js';
import { getMCPClient } from '../../src/mcp/client.js';

// Mock MCP Client
vi.mock('../../src/mcp/client.js', () => ({
  getMCPClient: vi.fn(),
}));

describe('E2E: 发送前双重确认', () => {
  let gateway: ReturnType<typeof getApprovalGateway>;
  let mockMCP: ReturnType<typeof createMockMCPClient>;

  beforeEach(() => {
    mockMCP = createMockMCPClient();
    (getMCPClient as any).mockReturnValue(mockMCP as any);
    gateway = getApprovalGateway();
    gateway.clearState();
    vi.clearAllMocks();
  });

  it('应该完整执行双重确认流程（无新消息）', async () => {
    // ========================================================================
    // 步骤 1: 准备草稿
    // ========================================================================
    const context = createScenario()
      .withSlackMessage('API is down', 'U_USER_1')
      .buildContext();

    await gateway.prepareDraft({
      channel: '#incidents',
      text: 'We are investigating the API issue...',
      pull_ts: '1234567890',
      context,
    });

    const state = gateway.getState();
    expect(state?.status).toBe('WAITING_CONFIRM');
    expect(state?.draft).toBeDefined();
    expect(state?.draft?.text).toContain('investigating');

    // ========================================================================
    // 步骤 2: 模拟第二次 Pull（无新消息）
    // ========================================================================
    mockMCP.mockResponse('slack_check_new_messages', {
      hasNewMessages: false,
      count: 0,
      messages: [],
    });

    const confirmResult = await gateway.confirm();
    expect(confirmResult.status).toBe('PULL_2_CHECK');
    expect(confirmResult.hasNewMessages).toBe(false);

    // ========================================================================
    // 步骤 3: 发送消息
    // ========================================================================
    mockMCP.mockResponse('slack_send_message', {
      ok: true,
      ts: '1234567891',
      channel: 'C123',
    });

    const sendResult = await gateway.send();
    expect(sendResult.success).toBe(true);
    expect(sendResult.ts).toBe('1234567891');

    console.log('✅ E2E 测试通过：双重确认流程（无新消息）');
  });

  it('应该检测到新消息并重新分析', async () => {
    // ========================================================================
    // 步骤 1: 准备草稿
    // ========================================================================
    const context = createScenario()
      .withSlackMessage('API is down', 'U_USER_1')
      .buildContext();

    await gateway.prepareDraft({
      channel: '#incidents',
      text: 'We are investigating...',
      pull_ts: '1234567890',
      context,
    });

    // ========================================================================
    // 步骤 2: 模拟第二次 Pull（有新消息）
    // ========================================================================
    mockMCP.mockResponse('slack_check_new_messages', {
      hasNewMessages: true,
      count: 1,
      messages: [
        {
          ts: '1234567891',
          user: 'U_USER_2',
          text: 'Update: found the cause!',
        },
      ],
    });

    const confirmResult = await gateway.confirm();
    expect(confirmResult.hasNewMessages).toBe(true);
    expect(confirmResult.newMessageCount).toBe(1);

    // 有新消息时，应该重新分析（在实际流程中会触发 re-analyze）
    expect(gateway.shouldReanalyze(confirmResult.hasNewMessages)).toBe(true);

    console.log('✅ E2E 测试通过：双重确认流程（有新消息）');
  });

  it('应该允许用户修改草稿', async () => {
    // ========================================================================
    // 步骤 1: 准备草稿
    // ========================================================================
    const context = createScenario().buildContext();

    await gateway.prepareDraft({
      channel: '#incidents',
      text: 'Original response',
      pull_ts: '1234567890',
      context,
    });

    // ========================================================================
    // 步骤 2: 用户修改草稿
    // ========================================================================
    const modifyResult = await gateway.modify('Modified response with more details');

    expect(modifyResult.status).toBe('WAITING_CONFIRM');
    expect(modifyResult.draft.text).toBe('Modified response with more details');

    console.log('✅ E2E 测试通过：修改草稿');
  });

  it('应该允许用户补充本地信息', async () => {
    // ========================================================================
    // 步骤 1: 准备草稿
    // ========================================================================
    const context = createScenario().buildContext();

    await gateway.prepareDraft({
      channel: '#incidents',
      text: 'Standard response',
      pull_ts: '1234567890',
      context,
    });

    // ========================================================================
    // 步骤 2: 用户补充本地信息
    // ========================================================================
    const supplementResult = await gateway.supplement(
      'Additional info: DB was overloaded'
    );

    expect(supplementResult.status).toBe('REANALYZING');
    expect(supplementResult.localInput).toBe('Additional info: DB was overloaded');

    const state = gateway.getState();
    expect(state?.localInput?.text).toBe('Additional info: DB was overloaded');

    console.log('✅ E2E 测试通过：补充本地信息');
  });

  it('应该允许用户取消发送', async () => {
    // ========================================================================
    // 步骤 1: 准备草稿
    // ========================================================================
    const context = createScenario().buildContext();

    await gateway.prepareDraft({
      channel: '#incidents',
      text: 'Response to cancel',
      pull_ts: '1234567890',
      context,
    });

    // ========================================================================
    // 步骤 2: 用户取消
    // ========================================================================
    const cancelResult = await gateway.cancel();

    expect(cancelResult.status).toBe('CANCELLED');
    expect(gateway.getState()).toBeUndefined();

    console.log('✅ E2E 测试通过：取消发送');
  });

  it('应该允许用户请求进一步调查', async () => {
    // ========================================================================
    // 步骤 1: 准备草稿
    // ========================================================================
    const context = createScenario().buildContext();

    await gateway.prepareDraft({
      channel: '#incidents',
      text: 'Preliminary response',
      pull_ts: '1234567890',
      context,
    });

    // ========================================================================
    // 步骤 2: 用户请求调查
    // ========================================================================
    const investigateResult = await gateway.investigate();

    expect(investigateResult.status).toBe('REANALYZING');

    console.log('✅ E2E 测试通过：请求进一步调查');
  });
});

describe('E2E: 草稿格式化', () => {
  it('应该正确格式化草稿用于显示', () => {
    const draft = {
      channel: '#incidents',
      text: 'Test response message',
      generated_at: Date.now(),
      pull_ts: '1234567890',
    };

    const formatted = formatDraftForDisplay(draft);

    expect(formatted).toContain('📤 准备发送以下回复到 Slack');
    expect(formatted).toContain('#incidents');
    expect(formatted).toContain('Test response message');
    expect(formatted).toContain('✓ 确认发送');
    expect(formatted).toContain('✏️ 修改草稿');
    expect(formatted).toContain('🔍 进一步调查');
    expect(formatted).toContain('💬 补充本地信息');
    expect(formatted).toContain('❌ 取消');
  });

  it('应该包含线程信息', () => {
    const draft = {
      channel: '#incidents',
      text: 'Thread reply',
      thread_ts: '1234567890',
      generated_at: Date.now(),
      pull_ts: '1234567890',
    };

    const formatted = formatDraftForDisplay(draft);
    expect(formatted).toContain('线程：1234567890');
  });
});

describe('E2E: 用户操作解析', () => {
  it('应该正确解析所有预设操作', () => {
    expect(parseUserAction('1').action).toBe('confirm');
    expect(parseUserAction('2').action).toBe('modify');
    expect(parseUserAction('3').action).toBe('investigate');
    expect(parseUserAction('4').action).toBe('supplement');
    expect(parseUserAction('5').action).toBe('cancel');
  });

  it('应该将自定义输入视为补充', () => {
    const result = parseUserAction('Custom message here');
    expect(result.action).toBe('supplement');
    expect(result.value).toBe('Custom message here');
  });

  it('应该处理带空格的输入', () => {
    expect(parseUserAction('  1  ').action).toBe('confirm');
    expect(parseUserAction('  custom  ').action).toBe('supplement');
  });
});
