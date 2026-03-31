/**
 * Qwen Provider Implementation
 * 
 * Uses DashScope API (OpenAI-compatible mode) for Qwen models.
 */

import OpenAI from 'openai';
import {
  AIProvider,
  AIProviderConfig,
  AnalysisResult,
  MergedContext,
  InvestigationPlan,
  IncidentIntent,
} from './provider.js';
import { aiLogger } from '../config/logger.js';

export class QwenProvider implements AIProvider {
  readonly name = 'qwen';
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });
  }

  /**
   * Analyze context and identify intent
   */
  async analyze(context: MergedContext): Promise<AnalysisResult> {
    aiLogger.info('[QwenProvider] Analyzing context...');

    const prompt = this.buildAnalysisPrompt(context);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are an AI incident response assistant. Analyze the incident discussion and identify:
1. The intent type (problem_report, information_update, question, resolution, other)
2. Severity level (P0-P3) if applicable
3. Missing information needed to resolve the incident
4. Whether investigation is needed
5. Suggested response or follow-up questions

Respond in JSON format.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      aiLogger.debug('[QwenProvider] Analysis response:', content);

      const parsed = JSON.parse(content);
      return this.parseAnalysisResult(parsed);
    } catch (error) {
      aiLogger.error('[QwenProvider] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate a response based on analysis
   */
  async generateResponse(
    analysis: AnalysisResult,
    context: MergedContext
  ): Promise<string> {
    aiLogger.info('[QwenProvider] Generating response...');

    const prompt = this.buildResponsePrompt(analysis, context);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You are an AI incident response assistant. Generate a clear, helpful response based on the analysis.
- Be concise but informative
- Include specific action items
- Mention confidence level
- Suggest next steps`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
      });

      const content = response.choices[0]?.message?.content || '';
      aiLogger.debug('[QwenProvider] Response generated:', content);

      return content;
    } catch (error) {
      aiLogger.error('[QwenProvider] Response generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate follow-up questions
   */
  async generateQuestions(missingInfo: string[]): Promise<string[]> {
    if (missingInfo.length === 0) {
      return [];
    }

    aiLogger.info('[QwenProvider] Generating follow-up questions...');

    const prompt = `Based on the missing information below, generate clear, specific questions to ask the incident reporters:

Missing Information:
${missingInfo.map((info) => `- ${info}`).join('\n')}

Generate questions in JSON array format: ["question 1", "question 2", ...]`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'Generate clear, specific questions for incident response.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return parsed.questions || parsed || [];
    } catch (error) {
      aiLogger.error('[QwenProvider] Question generation failed:', error);
      return missingInfo.map((info) => `Could you provide more details about: ${info}?`);
    }
  }

  /**
   * Decide investigation plan
   */
  async decideInvestigation(analysis: AnalysisResult): Promise<InvestigationPlan> {
    if (!analysis.needsInvestigation) {
      return { steps: [], priority: 'low' };
    }

    aiLogger.info('[QwenProvider] Deciding investigation plan...');

    const prompt = `Based on the incident analysis, create an investigation plan.
Consider these tools:
- github: Check recent commits, PRs, code changes
- logs: Query error logs, access logs
- prometheus: Check metrics, alerts, anomalies

Analysis:
- Intent: ${analysis.intent.type}
- Severity: ${analysis.intent.severity}
- Affected Service: ${analysis.intent.affectedService}
- Description: ${analysis.intent.description}

Respond in JSON format with steps array.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'Create a systematic investigation plan for incident response.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        steps: parsed.steps || [],
        priority: parsed.priority || 'medium',
      };
    } catch (error) {
      aiLogger.error('[QwenProvider] Investigation planning failed:', error);
      return {
        steps: [
          {
            tool: 'logs',
            action: 'query',
            query: 'error logs for affected service',
            purpose: 'Identify error patterns',
          },
        ],
        priority: 'medium',
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      return response.choices.length > 0;
    } catch (error) {
      aiLogger.error('[QwenProvider] Health check failed:', error);
      return false;
    }
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(context: MergedContext): string {
    const timeline = context.timeline
      .map((event) => {
        const time = new Date(parseFloat(event.ts) * 1000).toLocaleTimeString();
        const source = event.source === 'SLACK' ? 'Slack' : 'Local';
        const user = event.user ? `@${event.user}` : '[User]';
        return `[${time}] (${source}) ${user}: ${event.content}`;
      })
      .join('\n');

    return `Analyze the following incident discussion timeline:

Channel: ${context.metadata.channel}
Participants: ${context.metadata.participants.join(', ')}

Timeline:
${timeline}

Respond in JSON format:
{
  "intent": {
    "type": "problem_report|information_update|question|resolution|other",
    "severity": "P0|P1|P2|P3",
    "affectedService": "service name",
    "description": "what happened",
    "reporter": "user name"
  },
  "confidence": 0.0-1.0,
  "missingInfo": ["missing info 1", "missing info 2"],
  "suggestedQuestions": ["question 1", "question 2"],
  "needsInvestigation": true/false,
  "investigationPlan": {
    "steps": [
      {"tool": "github|logs|prometheus", "action": "...", "query": "...", "purpose": "..."}
    ],
    "priority": "high|medium|low"
  },
  "suggestedResponse": "draft response"
}`;
  }

  /**
   * Build response prompt
   */
  private buildResponsePrompt(
    analysis: AnalysisResult,
    context: MergedContext
  ): string {
    return `Based on this analysis, generate a response for the incident channel:

Analysis:
- Intent: ${analysis.intent.type}
- Severity: ${analysis.intent.severity || 'N/A'}
- Confidence: ${(analysis.confidence * 100).toFixed(0)}%
- Missing Info: ${analysis.missingInfo.join(', ') || 'None'}
- Needs Investigation: ${analysis.needsInvestigation}

Context:
${context.timeline.map((e) => `- ${e.content}`).join('\n')}

Generate a clear, professional response.`;
  }

  /**
   * Parse analysis result from AI response
   */
  private parseAnalysisResult(parsed: any): AnalysisResult {
    return {
      intent: {
        type: parsed.intent?.type || 'other',
        severity: parsed.intent?.severity,
        affectedService: parsed.intent?.affectedService,
        description: parsed.intent?.description,
        reporter: parsed.intent?.reporter,
      },
      confidence: parsed.confidence || 0.5,
      missingInfo: parsed.missingInfo || [],
      suggestedQuestions: parsed.suggestedQuestions || [],
      needsInvestigation: parsed.needsInvestigation || false,
      investigationPlan: parsed.investigationPlan,
      suggestedResponse: parsed.suggestedResponse,
    };
  }
}

/**
 * Factory function to create QwenProvider
 */
export function createQwenProvider(config: AIProviderConfig): QwenProvider {
  return new QwenProvider(config);
}
