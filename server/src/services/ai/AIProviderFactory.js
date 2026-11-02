import { env } from '../../config/env.js';
import { GeminiProvider } from './GeminiProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { FallbackProvider } from './FallbackProvider.js';
import { normalizeEvaluation } from './normalizeEvaluation.js';

/**
 * Routes AI work to the configured provider and degrades gracefully to the
 * offline question bank / heuristic evaluator on any failure (bad key,
 * timeout, malformed JSON, out-of-range scores).
 */
export class AIServiceManager {
  constructor({ primary, fallback = new FallbackProvider() } = {}) {
    this.fallbackProvider = fallback;
    this.primaryProvider = primary === undefined ? this.resolvePrimaryProvider() : primary || fallback;
  }

  resolvePrimaryProvider() {
    const name = env.AI_PROVIDER;
    const opts = { timeoutMs: env.AI_TIMEOUT_MS };

    if (name === 'gemini' && env.AI_API_KEY) {
      if (!env.isTest) console.log(`[AI] Using Google Gemini (${env.AI_MODEL})`);
      return new GeminiProvider(env.AI_API_KEY, env.AI_MODEL, opts);
    }
    if (name === 'openai' && env.AI_API_KEY) {
      if (!env.isTest) console.log(`[AI] Using OpenAI (${env.AI_MODEL})`);
      return new OpenAIProvider(env.AI_API_KEY, env.AI_MODEL, opts);
    }
    if (name !== 'fallback' && !env.isTest) {
      console.warn(`[AI] AI_PROVIDER=${name} but AI_API_KEY is empty — using the offline question bank.`);
    } else if (!env.isTest) {
      console.log('[AI] Using the offline question bank and rubric evaluator.');
    }
    return this.fallbackProvider;
  }

  get usesFallbackOnly() {
    return this.primaryProvider === this.fallbackProvider;
  }

  async generateQuestions(config) {
    if (!this.usesFallbackOnly) {
      try {
        const result = await this.primaryProvider.generateQuestions(config);
        const questions = result.questions || [];
        if (questions.length >= config.questionCount) {
          return { ...result, questions: questions.slice(0, config.questionCount) };
        }
        // Top up a short LLM response from the curated bank instead of failing.
        const extra = await this.fallbackProvider.generateQuestions({
          ...config,
          questionCount: config.questionCount - questions.length,
          excludeTexts: questions.map((q) => q.questionText),
        });
        return { ...result, questions: [...questions, ...extra.questions] };
      } catch (err) {
        console.warn(`[AI] ${this.primaryProvider.name} question generation failed: ${err.message}. Using question bank.`);
      }
    }
    return this.fallbackProvider.generateQuestions(config);
  }

  async evaluateAnswer(data) {
    if (!this.usesFallbackOnly) {
      try {
        const raw = await this.primaryProvider.evaluateAnswer(data);
        return normalizeEvaluation(raw, { provider: this.primaryProvider.name, isFallback: false });
      } catch (err) {
        console.warn(`[AI] ${this.primaryProvider.name} evaluation failed: ${err.message}. Using rubric heuristics.`);
      }
    }
    const raw = await this.fallbackProvider.evaluateAnswer(data);
    return normalizeEvaluation(raw, { provider: 'fallback', isFallback: true });
  }
}

export const aiService = new AIServiceManager();
