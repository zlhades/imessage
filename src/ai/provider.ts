/**
 * ============================================================================
 * AI Provider - 抽象接口定义
 * ============================================================================
 * 
 * 本文件定义了 AI Provider 的标准接口，所有 AI 提供商（Qwen、Claude 等）
 * 都必须实现此接口。
 * 
 * 设计目的:
 * - 统一不同 AI Provider 的调用方式
 * - 支持热切换 AI 后端（从 Qwen 切换到 Claude）
 * - 便于测试和 mock
 * 
 * 使用示例:
 * ```typescript
 * // 创建 Provider
 * const provider = createQwenProvider(config);
 * 
 * // 分析上下文
 * const analysis = await provider.analyze(context);
 * 
 * // 生成回复
 * const response = await provider.generateResponse(analysis, context);
 * ```
 * 
 * @module ai/provider
 */

/**
 * ============================================================================
 * 数据类型定义
 * ============================================================================
 */

/**
 * AI 分析结果
 * 
 * 包含 AI 对当前事件讨论的完整分析：
 * - intent: 识别的意图（问题报告、信息更新等）
 * - confidence: 置信度 (0-1)
 * - missingInfo: 缺失的信息列表
 * - suggestedQuestions: 建议的追问
 * - needsInvestigation: 是否需要进一步调查
 * - investigationPlan: 调查计划（如果需要）
 * - suggestedResponse: 建议的回复（如果信息完整）
 */
export interface AnalysisResult {
  intent: IncidentIntent;           // 识别的意图
  confidence: number;               // 置信度 (0.0-1.0)
  missingInfo: string[];            // 缺失的信息
  suggestedQuestions: string[];     // 建议的追问问题
  needsInvestigation: boolean;      // 是否需要调查
  investigationPlan?: InvestigationPlan;  // 调查计划
  suggestedResponse?: string;       // 建议的回复
}

/**
 * 事件意图识别
 * 
 * 类型说明:
 * - problem_report: 问题报告（如"服务挂了"）
 * - information_update: 信息更新（如"我发现了原因"）
 * - question: 询问（如"有人知道怎么回事吗"）
 * - resolution: 问题解决（如"已修复"）
 * - other: 其他
 * 
 * 严重性级别:
 * - P0: 严重故障（核心服务不可用）
 * - P1: 高优先级（大面积影响）
 * - P2: 中等优先级（部分影响）
 * - P3: 低优先级（轻微影响）
 */
export interface IncidentIntent {
  type: 'problem_report' | 'information_update' | 'question' | 'resolution' | 'other';
  severity?: 'P0' | 'P1' | 'P2' | 'P3';  // 严重性
  affectedService?: string;              // 受影响的服务
  description?: string;                  // 问题描述
  reporter?: string;                     // 报告人
}

/**
 * 调查计划
 * 
 * 由 AI 生成的系统性调查步骤，用于自动诊断问题。
 * 
 * 示例:
 * ```json
 * {
 *   "steps": [
 *     {
 *       "tool": "prometheus",
 *       "action": "check_health",
 *       "query": "api-service",
 *       "purpose": "检查服务健康状态"
 *     },
 *     {
 *       "tool": "github",
 *       "action": "get_recent_commits",
 *       "query": "org/repo",
 *       "purpose": "查看最近的代码变更"
 *     }
 *   ],
 *   "priority": "high"
 * }
 * ```
 */
export interface InvestigationPlan {
  steps: Array<{
    tool: string;      // 工具名称（slack/github/prometheus）
    action: string;    // 操作类型
    query: string;     // 查询参数
    purpose: string;   // 调查目的
  }>;
  priority: 'high' | 'medium' | 'low';  // 优先级
}

/**
 * 合并后的上下文
 * 
 * 包含来自 Slack 和本地的所有输入，按时间线组织。
 * 
 * 使用场景:
 * - AI 分析时需要完整的上下文
 * - 保持对话历史的一致性
 * - 支持多轮对话
 */
export interface MergedContext {
  slackMessages: SlackMessage[];   // Slack 消息列表
  localInputs: LocalInput[];       // 本地输入列表
  timeline: TimelineEvent[];       // 按时间排序的事件
  metadata: {                      // 元数据
    channel: string;               // Slack 频道
    threadTs?: string;             // 线程时间戳
    participants: string[];        // 参与者列表
    startTime?: Date;              // 开始时间
  };
}

/**
 * Slack 消息结构
 */
export interface SlackMessage {
  ts: string;           // 时间戳（Unix timestamp 字符串）
  user: string;         // 用户 ID
  text: string;         // 消息内容
  thread_ts?: string;   // 线程时间戳（如果是回复）
  type?: string;        // 消息类型
  subtype?: string;     // 消息子类型
}

/**
 * 本地输入结构
 * 
 * 来自本地终端的输入，用于补充 Slack 中没有的信息。
 * 
 * 类型说明:
 * - SUPPLEMENT: 补充信息（如"我刚查了日志，发现..."）
 * - INSTRUCTION: 指导 AI（如"去查一下过去 1 小时的错误"）
 * - CORRECTION: 纠正 AI（如"不是数据库问题，是网络问题"）
 */
export interface LocalInput {
  text: string;         // 输入内容
  timestamp: number;    // 时间戳（毫秒）
  type: 'SUPPLEMENT' | 'INSTRUCTION' | 'CORRECTION';  // 输入类型
}

/**
 * 时间线事件
 * 
 * 用于按时间顺序组织所有事件（Slack 消息、本地输入、AI 行动）。
 */
export interface TimelineEvent {
  ts: string;                      // 时间戳
  type: 'SLACK_MESSAGE' | 'LOCAL_INPUT' | 'AI_ACTION';  // 事件类型
  content: string;                 // 事件内容
  source: 'SLACK' | 'LOCAL';       // 来源
  user?: string;                   // 用户 ID（如果是 Slack 消息）
}

/**
 * ============================================================================
 * AI Provider 接口
 * ============================================================================
 * 
 * 所有 AI 提供商必须实现此接口。
 * 
 * 实现列表:
 * - QwenProvider: 阿里云通义千问（DashScope API）
 * - ClaudeProvider: Anthropic Claude（Anthropic API）
 */
export interface AIProvider {
  /**
   * Provider 名称
   * 
   * 用于日志和调试，如 'qwen', 'claude'
   */
  readonly name: string;

  /**
   * 分析上下文并识别意图
   * 
   * 这是核心方法，执行以下任务：
   * 1. 理解对话内容
   * 2. 识别事件类型和严重性
   * 3. 判断信息是否完整
   * 4. 决定是否需要调查
   * 
   * @param context 合并后的上下文
   * @returns 分析结果
   */
  analyze(context: MergedContext): Promise<AnalysisResult>;

  /**
   * 基于分析生成回复
   * 
   * 在信息完整时使用，生成专业、有帮助的回复。
   * 
   * @param analysis 分析结果
   * @param context 上下文（用于参考）
   * @returns 回复文本
   */
  generateResponse(analysis: AnalysisResult, context: MergedContext): Promise<string>;

  /**
   * 为缺失信息生成追问问题
   * 
   * 当信息不完整时，生成具体的追问问题。
   * 
   * @param missingInfo 缺失的信息列表
   * @returns 追问问题列表
   */
  generateQuestions(missingInfo: string[]): Promise<string[]>;

  /**
   * 决定调查计划
   * 
   * 当需要进一步调查时，生成系统性的调查步骤。
   * 
   * @param analysis 分析结果
   * @returns 调查计划
   */
  decideInvestigation(analysis: AnalysisResult): Promise<InvestigationPlan>;

  /**
   * 健康检查
   * 
   * 用于检测 AI Provider 是否可用。
   * 
   * @returns 是否健康
   */
  healthCheck(): Promise<boolean>;
}

/**
 * AI Provider 配置
 * 
 * 支持两种类型：
 * - openai-compatible: 兼容 OpenAI API 的服务（如 DashScope）
 * - anthropic: Anthropic API
 */
export interface AIProviderConfig {
  type: 'openai-compatible' | 'anthropic';  // API 类型
  baseUrl: string;       // API 基础 URL
  apiKey: string;        // API 密钥
  model: string;         // 模型名称
  contextLimit?: number; // 上下文长度限制（tokens）
}
