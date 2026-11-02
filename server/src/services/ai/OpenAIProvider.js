import { AIProvider } from './AIProvider.js';
import { buildQuestionGenerationPrompt } from './prompts/questionPrompts.js';
import { buildEvaluationPrompt, EVALUATION_SYSTEM_PROMPT } from './prompts/evaluationPrompts.js';
import { cleanAndParseJSON, validateQuestionsSchema } from './jsonParser.js';
import { fetchJSON } from './http.js';

export class OpenAIProvider extends AIProvider {
  constructor(apiKey, model = 'gpt-4o-mini', { timeoutMs = 20000, baseUrl = 'https://api.openai.com/v1' } = {}) {
    super('openai');
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.baseUrl = baseUrl;
  }

  async #chat(system, user, { temperature, signal }) {
    if (!this.apiKey) throw new Error('OpenAI API key is not configured.');

    const data = await fetchJSON(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      timeoutMs: this.timeoutMs,
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        response_format: { type: 'json_object' },
      }),
    });

    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('OpenAI returned an empty response.');
    return cleanAndParseJSON(text);
  }

  async generateQuestions(config, { signal } = {}) {
    const parsed = await this.#chat(
      'You are a senior engineering interviewer. Respond with a single JSON object only.',
      buildQuestionGenerationPrompt(config),
      { temperature: 0.6, signal }
    );
    return {
      questions: validateQuestionsSchema(parsed),
      provider: 'openai',
      isFallback: false,
      model: this.model,
    };
  }

  async evaluateAnswer(data, { signal } = {}) {
    return this.#chat(EVALUATION_SYSTEM_PROMPT, buildEvaluationPrompt(data), { temperature: 0.2, signal });
  }
}
