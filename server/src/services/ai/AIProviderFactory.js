import { env } from '../../config/env.js';
import { LocalAIProvider } from './LocalAIProvider.js';
import { FallbackProvider } from './FallbackProvider.js';
import { RuleBasedProvider } from './RuleBasedProvider.js';
import { normalizeEvaluation } from './evaluation.js';

export class AIServiceManager {
  constructor(config = env, { localProvider, fallbackProvider } = {}) {
    this.configuredProvider = config.AI_PROVIDER;
    this.fallbackProvider = fallbackProvider || new FallbackProvider();
    this.primaryProvider = config.AI_PROVIDER === 'rules' ? new RuleBasedProvider() : config.AI_PROVIDER === 'local'
      ? localProvider || new LocalAIProvider({ backend: config.LOCAL_AI_BACKEND, baseURL: config.LOCAL_AI_URL, model: config.LOCAL_AI_MODEL, timeoutMs: config.LOCAL_AI_TIMEOUT_MS })
      : this.fallbackProvider;
  }
  async status() {
    if (this.configuredProvider === 'rules') return { configuredProvider: 'rules', effectiveProvider: 'rules', apiKeyRequired: false, localOnly: true, ...await this.primaryProvider.status() };
    const local = this.primaryProvider === this.fallbackProvider ? { available: false, message: 'Question-bank mode is selected.' } : await this.primaryProvider.status();
    return { configuredProvider: this.configuredProvider, effectiveProvider: local.available ? 'local' : 'fallback',
      apiKeyRequired: false, localOnly: true, ...local };
  }
  async generateQuestions(config) {
    const bank = await this.fallbackProvider.generateQuestions(config);
    if (bank.questions.length === config.questionCount) return bank;
    let reason;
    if (this.primaryProvider !== this.fallbackProvider && (await this.primaryProvider.status()).available) {
      try {
        const result = await this.primaryProvider.generateQuestions(config);
        if (result.questions.length !== config.questionCount) throw new Error('The AI did not return the requested question count.');
        return result;
      } catch (error) { reason = 'Local AI could not finish this request. Using the question bank.'; console.warn('[AI] Generation fallback:', error.message); }
    } else if (this.primaryProvider !== this.fallbackProvider) {
      reason = 'Local AI is unavailable. Using the question bank; no API key is needed.';
    }
    return { ...bank, message: [reason, bank.message].filter(Boolean).join(' ') || null };
  }
  async evaluateAnswer(config) {
    if (this.configuredProvider === 'rules') return normalizeEvaluation(await this.primaryProvider.evaluateAnswer(config));
    if (this.primaryProvider !== this.fallbackProvider && (await this.primaryProvider.status()).available) {
      try { return normalizeEvaluation(await this.primaryProvider.evaluateAnswer(config)); }
      catch (error) { console.warn('[AI] Evaluation fallback:', error.message); }
    }
    return this.fallbackProvider.evaluateAnswer(config);
  }
}
export const aiService = new AIServiceManager();
