import { AIProvider } from './AIProvider.js';
import { findBankQuestion, selectBankQuestions } from './QuestionCatalog.js';
const stopwords = new Set('the and with that this from into when then are for can use not how what why which one two each any must should may has have using used than its also more between does'.split(' '));
const tokens = (text) => [...new Set(String(text).toLowerCase().replace(/o\s*\(\s*n\s*\)/g, ' linear time ').replace(/o\s*\(\s*1\s*\)/g, ' constant time ').replace(/second pass|two passes|two-pass|2 passes/g, ' two pass ').replace(/[^a-z0-9+#]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !stopwords.has(word)))];
export class FallbackProvider extends AIProvider {
  constructor() { super('fallback'); }
  async generateQuestions(config) { return selectBankQuestions(config); }
  async evaluateAnswer(input) {
    const guide = findBankQuestion(input);
    const concepts = input.referenceConcepts || guide?.referenceConcepts || [];
    const words = new Set(tokens(input.candidateAnswer || ''));
    const mentionedConcepts = [], missingConcepts = [];
    for (const concept of concepts) {
      const expected = tokens(concept);
      (expected.length && expected.filter((word) => words.has(word)).length >= Math.min(2, expected.length) ? mentionedConcepts : missingConcepts).push(concept);
    }
    const referenceAnswer = input.referenceAnswer || guide?.referenceAnswer;
    return {
      overallScore: null, criteriaScores: { technicalCorrectness: 0, relevance: 0, completeness: 0, clarity: 0 },
      evaluationKind: 'concept-check', coveragePercent: concepts.length ? Math.round(100 * mentionedConcepts.length / concepts.length) : null,
      mentionedConcepts, correctConcepts: [], missingConcepts, mistakes: [],
      explanation: 'This checks whether reference terms appear. It cannot establish correctness, detect every contradiction, or reliably recognize paraphrases. No interview score was assigned.',
      feedback: 'Your answer is saved. Compare its reasoning with the worked answer below. Term mentions are a study checklist, not proof of correctness.',
      improvedAnswer: referenceAnswer || 'A worked answer is not available for this older question. Use the reference concepts as a study outline and verify the explanation against the relevant documentation.',
      followUpQuestions: input.followUpQuestions?.length ? input.followUpQuestions : guide?.followUpQuestions || [],
      answerSource: referenceAnswer ? input.answerSource || guide?.answerSource || 'curated' : 'outline',
      recommendedTopics: [input.topic].filter(Boolean), provider: 'fallback', isFallback: true,
    };
  }
}
