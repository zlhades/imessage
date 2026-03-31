/**
 * Provider Router
 * 
 * Routes AI requests to the active provider (Qwen or Claude).
 * Supports hot-swapping between providers.
 */

import { AIProvider, AIProviderConfig, MergedContext, AnalysisResult, InvestigationPlan } from './provider.js';
import { QwenProvider, createQwenProvider } from './qwen-provider.js';
import { ClaudeProvider, createClaudeProvider } from './claude-provider.js';
import { aiLogger } from '../config/logger.js';

export type ProviderType = 'qwen' | 'claude';

export interface ProviderRouterConfig {
  active: ProviderType;
  qwen: AIProviderConfig;
  claude: AIProviderConfig;
  fallback?: {
    enabled: boolean;
    retryOnFailure: boolean;
    maxRetries: number;
  };
}

export class ProviderRouter implements AIProvider {
  private activeProvider: AIProvider;
  private providers: Map<ProviderType, AIProvider> = new Map();
  private config: ProviderRouterConfig;

  constructor(config: ProviderRouterConfig) {
    this.config = config;
    
    // Initialize all providers
    this.providers.set('qwen', createQwenProvider(config.qwen));
    this.providers.set('claude', createClaudeProvider(config.claude));
    
    // Set active provider
    this.activeProvider = this.providers.get(config.active)!;
    
    aiLogger.info(`[Router] Initialized with active provider: ${config.active}`);
  }

  /**
   * Get the name of the active provider
   */
  get name(): string {
    return this.activeProvider.name;
  }

  /**
   * Switch to a different provider
   */
  switchProvider(type: ProviderType): void {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`Provider not found: ${type}`);
    }
    
    aiLogger.info(`[Router] Switching provider from ${this.activeProvider.name} to ${type}`);
    this.activeProvider = provider;
    this.config.active = type;
  }

  /**
   * Get current active provider type
   */
  getActiveProviderType(): ProviderType {
    return this.config.active;
  }

  /**
   * Analyze with retry/fallback support
   */
  async analyze(context: MergedContext): Promise<AnalysisResult> {
    return this.executeWithFallback(() => this.activeProvider.analyze(context));
  }

  /**
   * Generate response with retry/fallback support
   */
  async generateResponse(analysis: AnalysisResult, context: MergedContext): Promise<string> {
    return this.executeWithFallback(() => 
      this.activeProvider.generateResponse(analysis, context)
    );
  }

  /**
   * Generate questions with retry/fallback support
   */
  async generateQuestions(missingInfo: string[]): Promise<string[]> {
    return this.executeWithFallback(() => 
      this.activeProvider.generateQuestions(missingInfo)
    );
  }

  /**
   * Decide investigation with retry/fallback support
   */
  async decideInvestigation(analysis: AnalysisResult): Promise<InvestigationPlan> {
    return this.executeWithFallback(() => 
      this.activeProvider.decideInvestigation(analysis)
    );
  }

  /**
   * Health check for active provider
   */
  async healthCheck(): Promise<boolean> {
    return this.activeProvider.healthCheck();
  }

  /**
   * Health check for all providers
   */
  async healthCheckAll(): Promise<Record<ProviderType, boolean>> {
    const results: Record<ProviderType, boolean> = {
      qwen: false,
      claude: false,
    };
    
    for (const [type, provider] of this.providers.entries()) {
      results[type as ProviderType] = await provider.healthCheck();
    }
    
    return results;
  }

  /**
   * Execute with fallback support
   */
  private async executeWithFallback<T>(
    fn: () => Promise<T>,
    retries = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      aiLogger.error('[Router] Provider execution failed:', error);
      
      // Check if fallback is enabled
      if (!this.config.fallback?.enabled) {
        throw error;
      }
      
      // Check if we should retry
      if (this.config.fallback.retryOnFailure && retries < this.config.fallback.maxRetries) {
        aiLogger.info(`[Router] Retrying... (${retries + 1}/${this.config.fallback.maxRetries})`);
        return this.executeWithFallback(fn, retries + 1);
      }
      
      // Try switching to other provider
      const otherProvider = this.getOtherProvider();
      if (otherProvider) {
        aiLogger.info(`[Router] Falling back to ${otherProvider.name}`);
        this.activeProvider = otherProvider;
        return fn();
      }
      
      throw error;
    }
  }

  /**
   * Get the other provider (for fallback)
   */
  private getOtherProvider(): AIProvider | null {
    const otherType = this.config.active === 'qwen' ? 'claude' : 'qwen';
    return this.providers.get(otherType) || null;
  }

  /**
   * Get provider stats
   */
  getStats(): {
    active: string;
    providers: Array<{
      name: string;
      type: string;
      healthy: boolean;
    }>;
  } {
    return {
      active: this.activeProvider.name,
      providers: Array.from(this.providers.entries()).map(([type, provider]) => ({
        name: provider.name,
        type,
        healthy: true, // Would need actual health check
      })),
    };
  }
}

/**
 * Factory function to create ProviderRouter
 */
export function createProviderRouter(config: ProviderRouterConfig): ProviderRouter {
  return new ProviderRouter(config);
}
