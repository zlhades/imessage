/**
 * ============================================================================
 * Approval Gateway - 发送前双重确认
 * ============================================================================
 * 
 * 本模块实现发送前的双重确认机制，确保 AI 生成的回复在发送前
 * 经过人工确认，并且在发送前没有新的信息影响回复的准确性。
 * 
 * 核心流程:
 * 
 * 1️⃣ 生成草稿
 *    ↓
 * 2️⃣ 显示给用户，等待确认
 *    ↓
 * 3️⃣ 用户确认
 *    ↓
 * 4️⃣ 第二次 Pull 检查新消息
 *    ↓
 * 5️⃣ 判断是否有新消息
 *    ├─ 有新消息 → 重新分析
 *    └─ 无新消息 → 发送
 * 
 * 设计目的:
 * - 防止发送过时或不准确的回复
 * - 在快速变化的事件讨论中保持信息同步
 * - 给人工干预的机会
 * 
 * 使用示例:
 * ```typescript
 * const gateway = getApprovalGateway();
 * 
 * // 1. 准备草稿
 * await gateway.prepareDraft({
 *   channel: '#incidents',
 *   text: '根据分析...',
 *   pull_ts: '1234567890'
 * });
 * 
 * // 2. 用户确认后，进行第二次 Pull
 * const result = await gateway.confirm();
 * 
 * // 3. 检查是否有新消息
 * if (result.hasNewMessages) {
 *   // 有新消息，需要重新分析
 * } else {
 *   // 无新消息，可以发送
 *   await gateway.send();
 * }
 * ```
 * 
 * @module approval/gateway
 */

import { getMCPClient } from '../mcp/client.js';
import { MergedContext } from '../ai/provider.js';
import { approvalLogger } from '../config/logger.js';

/**
 * ============================================================================
 * 类型定义
 * ============================================================================
 */

/**
 * 草稿回复
 * 
 * 包含准备发送到 Slack 的回复内容。
 */
export interface DraftResponse {
  channel: string;       // 目标频道
  text: string;          // 回复内容
  thread_ts?: string;    // 线程时间戳（如果是回复线程）
  generated_at: number;  // 生成时间（毫秒时间戳）
  pull_ts: string;       // 第一次 Pull 的时间戳（秒时间戳）
}

/**
 * 确认状态
 * 
 * 跟踪当前的确认流程状态。
 */
export interface ApprovalState {
  draft?: DraftResponse;         // 当前草稿
  context: MergedContext;        // 上下文
  localInput?: {               // 本地补充输入
    text: string;
    timestamp: number;
  };
  status:                      // 当前状态
    | 'WAITING_CONFIRM'        // 等待用户确认
    | 'PULL_2_CHECK'           // 第二次 Pull 检查中
    | 'SENDING'                // 发送中
    | 'REANALYZING'            // 重新分析中
    | 'SENT'                   // 已发送
    | 'CANCELLED';             // 已取消
}

/**
 * 用户操作类型
 */
export type UserAction = 
  | 'confirm'      // 确认发送
  | 'modify'       // 修改草稿
  | 'investigate'  // 进一步调查
  | 'supplement'   // 补充本地信息
  | 'cancel';      // 取消

/**
 * 用户操作结果
 */
export interface UserActionResult {
  action: UserAction;  // 操作类型
  value?: string;      // 操作值（如修改后的文本）
}

/**
 * ============================================================================
 * ApprovalGateway 类
 * ============================================================================
 * 
 * 管理发送前确认的完整流程。
 * 
 * 状态机:
 * 
 * ```
 * WAITING_CONFIRM ──→ 用户确认 ──→ PULL_2_CHECK ──→ 有新消息 ──→ REANALYZING
 *       ↑                                              ↓
 *       │                                              └─→ 无新消息 ──→ SENDING
 *       │
 *       └── 用户修改/补充 ──────────────────────────────┘
 * ```
 */
class ApprovalGateway {
  private state?: ApprovalState;  // 当前状态
  private mcpClient: any;          // MCP Client 实例

  /**
   * 构造函数
   */
  constructor() {
    this.mcpClient = getMCPClient();
  }

  /**
   * ============================================================================
   * 步骤 1: 准备草稿
   * ============================================================================
   * 
   * 创建草稿并进入等待确认状态。
   * 
   * @param params 草稿参数
   * @returns 创建的草稿
   */
  async prepareDraft(params: {
    channel: string;
    text: string;
    thread_ts?: string;
    pull_ts: string;
    context: MergedContext;
  }): Promise<DraftResponse> {
    approvalLogger.info('[Approval] Preparing draft...');

    // 初始化状态
    this.state = {
      draft: {
        channel: params.channel,
        text: params.text,
        thread_ts: params.thread_ts,
        generated_at: Date.now(),
        pull_ts: params.pull_ts,  // 记录第一次 Pull 的时间
      },
      context: params.context,
      status: 'WAITING_CONFIRM',
    };

    approvalLogger.info('[Approval] Draft prepared');

    return this.state.draft;
  }

  /**
   * ============================================================================
   * 步骤 2a: 用户确认 - 第二次 Pull 检查
   * ============================================================================
   * 
   * 用户确认发送后，执行第二次 Pull 检查是否有新消息。
   * 
   * 为什么需要第二次 Pull？
   * - 在 AI 分析和用户确认期间，Slack 中可能有新消息
   * - 新消息可能影响回复的准确性
   * - 确保发送的回复基于最新信息
   * 
   * @returns 检查结果
   */
  async confirm(): Promise<{
    status: 'PULL_2_CHECK';
    hasNewMessages: boolean;
    newMessageCount: number;
  }> {
    if (!this.state || this.state.status !== 'WAITING_CONFIRM') {
      throw new Error('No draft to confirm');
    }

    approvalLogger.info('[Approval] User confirmed, checking for new messages...');

    this.state.status = 'PULL_2_CHECK';

    // 第二次 Pull：检查自第一次 Pull 以来的新消息
    const result = await this.mcpClient.callTool('slack', 'slack_check_new_messages', {
      channel: this.state.draft!.channel,
      since_ts: this.state.draft!.pull_ts,  // 使用第一次 Pull 的时间戳
      thread_ts: this.state.draft!.thread_ts,
    });

    const content = JSON.parse(result.content[0].text);
    const hasNewMessages = content.hasNewMessages;
    const newMessageCount = content.count;

    approvalLogger.info(
      `[Approval] Second pull complete: ${newMessageCount} new messages`
    );

    return {
      status: 'PULL_2_CHECK',
      hasNewMessages,
      newMessageCount,
    };
  }

  /**
   * ============================================================================
   * 步骤 2b: 用户修改草稿
   * ============================================================================
   * 
   * 用户选择修改草稿内容。
   * 
   * @param newText 新的回复文本
   * @returns 更新后的状态
   */
  async modify(newText: string): Promise<{ status: 'WAITING_CONFIRM'; draft: DraftResponse }> {
    if (!this.state || !this.state.draft) {
      throw new Error('No draft to modify');
    }

    approvalLogger.info('[Approval] User modified draft');

    // 更新草稿文本和生成时间
    this.state.draft.text = newText;
    this.state.draft.generated_at = Date.now();

    return {
      status: 'WAITING_CONFIRM',
      draft: this.state.draft,
    };
  }

  /**
   * ============================================================================
   * 步骤 2c: 用户补充本地信息
   * ============================================================================
   * 
   * 用户提供 Slack 中没有的额外信息。
   * 
   * @param localInfo 补充的信息
   * @returns 重新分析状态
   */
  async supplement(localInfo: string): Promise<{ status: 'REANALYZING'; localInput: string }> {
    if (!this.state) {
      throw new Error('No state to supplement');
    }

    approvalLogger.info('[Approval] User supplemented with local info');

    // 保存本地输入
    this.state.localInput = {
      text: localInfo,
      timestamp: Date.now(),
    };
    this.state.status = 'REANALYZING';

    return {
      status: 'REANALYZING',
      localInput: localInfo,
    };
  }

  /**
   * ============================================================================
   * 步骤 2d: 用户请求进一步调查
   * ============================================================================
   * 
   * 用户认为需要更多调查才能回复。
   * 
   * @returns 重新分析状态
   */
  async investigate(): Promise<{ status: 'REANALYZING' }> {
    if (!this.state) {
      throw new Error('No state to investigate');
    }

    approvalLogger.info('[Approval] User requested further investigation');

    this.state.status = 'REANALYZING';

    return {
      status: 'REANALYZING',
    };
  }

  /**
   * ============================================================================
   * 步骤 2e: 用户取消
   * ============================================================================
   * 
   * 用户取消发送。
   * 
   * @returns 取消状态
   */
  async cancel(): Promise<{ status: 'CANCELLED' }> {
    approvalLogger.info('[Approval] User cancelled');

    this.state = undefined;

    return {
      status: 'CANCELLED',
    };
  }

  /**
   * ============================================================================
   * 判断是否需要重新分析
   * ============================================================================
   * 
   * 如果有新消息，需要重新分析。
   * 
   * @param hasNewMessages 是否有新消息
   * @returns 是否需要重新分析
   */
  shouldReanalyze(hasNewMessages: boolean): boolean {
    return hasNewMessages;
  }

  /**
   * ============================================================================
   * 步骤 3: 发送消息
   * ============================================================================
   * 
   * 通过 Slack MCP 发送消息。
   * 
   * @returns 发送结果
   */
  async send(): Promise<{ success: boolean; ts: string }> {
    if (!this.state || !this.state.draft) {
      throw new Error('No draft to send');
    }

    approvalLogger.info('[Approval] Sending message...');

    this.state.status = 'SENDING';

    try {
      // 调用 Slack MCP 发送消息
      const result = await this.mcpClient.callTool('slack', 'slack_send_message', {
        channel: this.state.draft.channel,
        text: this.state.draft.text,
        thread_ts: this.state.draft.thread_ts,
      });

      const response = JSON.parse(result.content[0].text);

      approvalLogger.info(`[Approval] Message sent: ${response.ts}`);

      this.state.status = 'SENT';
      this.state = undefined;  // 清除状态

      return {
        success: response.ok,
        ts: response.ts,  // 消息时间戳
      };
    } catch (error: any) {
      approvalLogger.error('[Approval] Failed to send message:', error);
      this.state.status = 'WAITING_CONFIRM';  // 恢复等待状态
      throw error;
    }
  }

  /**
   * ============================================================================
   * 获取/清除状态
   * ============================================================================
   */

  getState(): ApprovalState | undefined {
    return this.state;
  }

  clearState(): void {
    this.state = undefined;
  }
}

// ============================================================================
// 单例模式
// ============================================================================

let approvalGatewayInstance: ApprovalGateway | null = null;

/**
 * 获取 ApprovalGateway 单例
 */
export function getApprovalGateway(): ApprovalGateway {
  if (!approvalGatewayInstance) {
    approvalGatewayInstance = new ApprovalGateway();
  }
  return approvalGatewayInstance;
}

/**
 * ============================================================================
 * 工具函数
 * ============================================================================
 */

/**
 * 格式化草稿用于显示
 * 
 * @param draft 草稿
 * @returns 格式化后的文本
 */
export function formatDraftForDisplay(draft: DraftResponse): string {
  const lines = [
    '═'.repeat(60),
    '📤 准备发送以下回复到 Slack:',
    '═'.repeat(60),
    `频道：${draft.channel}`,
    draft.thread_ts ? `线程：${draft.thread_ts}` : '',
    '─'.repeat(60),
    draft.text,
    '─'.repeat(60),
    '',
    '请选择操作:',
    '  [1] ✓ 确认发送',
    '  [2] ✏️ 修改草稿',
    '  [3] 🔍 进一步调查',
    '  [4] 💬 补充本地信息',
    '  [5] ❌ 取消',
    '═'.repeat(60),
  ];

  return lines.filter((l) => l !== '').join('\n');
}

/**
 * 解析用户操作
 * 
 * @param input 用户输入
 * @returns 操作结果
 */
export function parseUserAction(input: string): UserActionResult {
  const trimmed = input.trim();

  switch (trimmed) {
    case '1':
      return { action: 'confirm' };
    case '2':
      return { action: 'modify' };
    case '3':
      return { action: 'investigate' };
    case '4':
      return { action: 'supplement' };
    case '5':
      return { action: 'cancel' };
    default:
      // 其他输入视为补充信息
      return { action: 'supplement', value: trimmed };
  }
}
