import { AIProvider } from './AIProvider.js';
import { FallbackProvider } from './FallbackProvider.js';
import { selectBankQuestions } from './QuestionCatalog.js';
import { gradeAnswer, RULE_VERSION } from './LocalRubricGrader.js';

/**
 * Key-free, model-free evaluation. Every question's saved answer and reference
 * concepts form a local rubric (see LocalRubricGrader); a candidate answer is
 * scored by how much of that rubric it covers.
 */
export class RuleBasedProvider extends AIProvider {
  constructor() { super('rules'); this.fallback = new FallbackProvider(); }
  async status() { return { available: true, backend: 'rules', model: null, message: 'Local rubric checker is ready. No language model, network connection or API key is used.' }; }
  async generateQuestions(config) { return selectBankQuestions(config); }
  async evaluateAnswer(input) {
    const graded = gradeAnswer(input);
    if (graded) return graded;
    const guide = await this.fallback.evaluateAnswer(input);
    return { ...guide, provider: 'rules', rubricVersion: RULE_VERSION,
      feedback: 'This question has no saved answer or reference concepts to compare with, so no score was assigned. Your answer is saved for review.' };
  }
}
