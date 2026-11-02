import { AIProvider } from './AIProvider.js';
import { buildQuestionGenerationPrompt } from './prompts/questionPrompts.js';
import { buildEvaluationPrompt, EVALUATION_SYSTEM_PROMPT } from './prompts/evaluationPrompts.js';
import { cleanAndParseJSON, validateQuestionsSchema } from './jsonParser.js';
import { fetchJSON } from './http.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider extends AIProvider {
  constructor(apiKey, model = 'gemini-2.5-flash', { timeoutMs = 20000 } = {}) {
    super('gemini');
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async #generate(prompt, { temperature, systemInstruction, signal }) {
    if (!this.apiKey) throw new Error('Gemini API key is not configured.');

    const data = await fetchJSON(`${API_BASE}/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      timeoutMs: this.timeoutMs,
      signal,
      headers: {
        'Content-Type': 'application/json',
        // Header auth keeps the key out of URLs and access logs.
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        ...(systemInstruction && { systemInstruction: { parts: [{ text: systemInstruction }] } }),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature },
      }),
    });

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
    if (!text) {
      const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || 'empty response';
      throw new Error(`Gemini returned no content (${reason}).`);
    }
    return cleanAndParseJSON(text);
  }

  async generateQuestions(config, { signal } = {}) {
    const parsed = await this.#generate(buildQuestionGenerationPrompt(config), { temperature: 0.6, signal });
    return {
      questions: validateQuestionsSchema(parsed),
      provider: 'gemini',
      isFallback: false,
      model: this.model,
    };
  }

  async evaluateAnswer(data, { signal } = {}) {
    return this.#generate(buildEvaluationPrompt(data), {
      temperature: 0.2,
      systemInstruction: EVALUATION_SYSTEM_PROMPT,
      signal,
    });
  }
}
