import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHeuristically, stem } from '../../src/services/ai/heuristicEvaluator.js';
import { normalizeEvaluation, CRITERIA_MAX } from '../../src/services/ai/normalizeEvaluation.js';
import { cleanAndParseJSON, validateQuestionsSchema } from '../../src/services/ai/jsonParser.js';
import { selectQuestions, FallbackProvider } from '../../src/services/ai/FallbackProvider.js';
import { FALLBACK_QUESTION_BANK } from '../../src/services/ai/FallbackQuestionBank.js';
import { AIServiceManager } from '../../src/services/ai/AIProviderFactory.js';
import { TOPICS } from '../../src/config/constants.js';

const bplus = FALLBACK_QUESTION_BANK.find((q) => q.questionText.startsWith('Explain the structure of a B+'));
const base = {
  questionText: bplus.questionText,
  referenceConcepts: bplus.referenceConcepts,
  evaluationCriteria: bplus.evaluationCriteria,
  topic: bplus.topic,
  difficulty: 'Medium',
};

const STRONG =
  'A B+ tree is a balanced search tree with very high fan-out: each internal node holds hundreds of keys because a node is sized to one disk page. ' +
  'Because of the high fan-out the tree height stays low, around 3 or 4 levels for millions of rows, so a lookup costs O(log n) page reads instead of reading every block. ' +
  'All values live in the leaf nodes, and leaves are linked to each other, so a range query finds the first key and then scans sideways through the linked leaves. ' +
  'A binary search tree has fan-out 2, so it is far taller and each node visit is a random disk I/O, which is very slow. ' +
  'For example, a range scan on a BST needs an in-order traversal touching many pages.';

const withinMaxima = (scores) =>
  Object.entries(CRITERIA_MAX).every(([k, max]) => Number.isInteger(scores[k]) && scores[k] >= 0 && scores[k] <= max);

describe('heuristic evaluator', () => {
  test('ranks strong > partial > short and stays within rubric maxima', () => {
    const strong = evaluateHeuristically({ ...base, candidateAnswer: STRONG });
    const partial = evaluateHeuristically({
      ...base,
      candidateAnswer: 'B+ trees keep all data in leaves which are linked, so range queries are fast. They reduce disk reads compared to a binary tree.',
    });
    const short = evaluateHeuristically({ ...base, candidateAnswer: 'B+ tree is faster.' });

    assert.ok(strong.overallScore >= 75, `strong scored ${strong.overallScore}`);
    assert.ok(strong.overallScore > partial.overallScore);
    assert.ok(partial.overallScore > short.overallScore);
    assert.ok(short.overallScore < 20);
    for (const r of [strong, partial, short]) {
      assert.ok(withinMaxima(r.criteriaScores));
      assert.equal(r.overallScore, Object.values(r.criteriaScores).reduce((a, b) => a + b, 0));
    }
    assert.equal(strong.correctConcepts.length, bplus.referenceConcepts.length);
  });

  test('gibberish, repetition and off-topic answers score low (no free floor)', () => {
    const gibberish = evaluateHeuristically({ ...base, candidateAnswer: 'asdf qwrtp zxcvbn '.repeat(6) });
    const repeated = evaluateHeuristically({ ...base, candidateAnswer: 'tree '.repeat(25) });
    const offTopic = evaluateHeuristically({
      ...base,
      candidateAnswer:
        'I really enjoy cooking pasta on weekends with my family, especially when we try new sauces and recipes from different regions of Italy.',
    });
    assert.ok(gibberish.overallScore < 10, `gibberish ${gibberish.overallScore}`);
    assert.ok(repeated.overallScore < 15, `repeated ${repeated.overallScore}`);
    assert.ok(offTopic.overallScore < 25, `off-topic ${offTopic.overallScore}`);
  });

  test('empty answer scores zero', () => {
    const r = evaluateHeuristically({ ...base, candidateAnswer: '' });
    assert.equal(r.overallScore, 0);
  });

  test('behavioral answers are judged by STAR structure', () => {
    const q = FALLBACK_QUESTION_BANK.find((x) => x.questionText.startsWith('Describe a technical disagreement'));
    const args = { questionText: q.questionText, referenceConcepts: q.referenceConcepts, evaluationCriteria: q.evaluationCriteria, topic: q.topic, type: 'Behavioral' };
    const star = evaluateHeuristically({
      ...args,
      candidateAnswer:
        'During my internship our team disagreed about whether to use REST or GraphQL for a new service. My role was to build the API. ' +
        'I proposed that we benchmark both, I built two small prototypes and shared the data in a meeting. ' +
        'As a result we chose REST, reduced latency by 30% and I learned to settle debates with evidence rather than opinions.',
    });
    const evasive = evaluateHeuristically({
      ...args,
      candidateAnswer: 'I am a team player and I always get along with everyone so I never really had disagreements.',
    });
    assert.ok(star.overallScore >= 60, `star ${star.overallScore}`);
    assert.ok(evasive.overallScore < 25, `evasive ${evasive.overallScore}`);
  });

  test('acronyms count as covering the concept', () => {
    const r = evaluateHeuristically({
      questionText: 'What is a process?',
      referenceConcepts: ['Process Control Block (PCB)'],
      candidateAnswer: 'Each process has a PCB that stores registers, state and memory info for context switching.',
    });
    assert.deepEqual(r.correctConcepts, ['Process Control Block (PCB)']);
  });

  test('stemmer normalizes common suffixes', () => {
    assert.equal(stem('queries'), stem('query'));
    assert.equal(stem('reduction'), stem('reduces'));
  });
});

describe('normalizeEvaluation', () => {
  test('clamps out-of-range and string scores and recomputes the total', () => {
    const r = normalizeEvaluation({
      overallScore: 250,
      criteriaScores: { technicalCorrectness: 95, relevance: '18', completeness: -4, clarity: 19.6 },
      correctConcepts: ['a', 42, ''],
      feedback: 'ok',
    });
    assert.deepEqual(r.criteriaScores, { technicalCorrectness: 40, relevance: 18, completeness: 0, clarity: 20 });
    assert.equal(r.overallScore, 78);
    assert.deepEqual(r.correctConcepts, ['a']);
    assert.deepEqual(r.missingConcepts, []);
  });

  test('accepts flat criteria and rejects outputs with no criteria', () => {
    assert.equal(normalizeEvaluation({ technicalCorrectness: 30, relevance: 10, completeness: 10, clarity: 10 }).overallScore, 60);
    assert.throws(() => normalizeEvaluation({ feedback: 'great' }));
    assert.throws(() => normalizeEvaluation(null));
  });
});

describe('JSON parsing of model output', () => {
  test('handles fences, trailing commas and surrounding prose', () => {
    assert.deepEqual(cleanAndParseJSON('```json\n{"a": [1,2,],}\n```'), { a: [1, 2] });
    assert.deepEqual(cleanAndParseJSON('Sure! Here it is: {"questions": []} Hope it helps.'), { questions: [] });
    assert.throws(() => cleanAndParseJSON('no json here'));
  });

  test('validateQuestionsSchema dedupes, defaults and rejects empty', () => {
    const out = validateQuestionsSchema({
      questions: [
        { questionText: 'Explain how TCP slow start works in practice.', difficulty: 'Insane', type: 'Quiz' },
        { questionText: 'Explain how TCP slow start works in practice.' },
        { questionText: 'short' },
      ],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].difficulty, 'Medium');
    assert.equal(out[0].type, 'Technical');
    assert.equal(out[0].evaluationCriteria.length, 3);
    assert.throws(() => validateQuestionsSchema({ questions: [] }));
  });
});

describe('offline question bank', () => {
  test('every UI topic has Easy, Medium and Hard questions', () => {
    for (const topic of TOPICS) {
      const tiers = new Set(FALLBACK_QUESTION_BANK.filter((q) => q.topic === topic).map((q) => q.difficulty));
      assert.deepEqual([...tiers].sort(), ['Easy', 'Hard', 'Medium'], `topic ${topic}`);
    }
  });

  test('selects unique questions round-robin across chosen topics', () => {
    const topics = ['JavaScript & TypeScript', 'React & Frontend Architecture'];
    const picked = selectQuestions({ topics, difficulty: 'Hard', questionCount: 4, interviewType: 'Technical' });
    assert.equal(picked.length, 4);
    assert.equal(new Set(picked.map((q) => q.questionText)).size, 4);
    assert.ok(picked.every((q) => topics.includes(q.topic)));
    assert.equal(picked.filter((q) => q.topic === topics[0]).length, 2);
  });

  test('respects interview type', () => {
    const hr = selectQuestions({ topics: ['Operating Systems'], difficulty: 'Medium', questionCount: 3, interviewType: 'Behavioral' });
    assert.ok(hr.every((q) => q.topic === 'HR & Behavioral'));
    const mixed = selectQuestions({ topics: ['System Design'], difficulty: 'Medium', questionCount: 5, interviewType: 'Mixed' });
    assert.equal(mixed.filter((q) => q.topic === 'HR & Behavioral').length, 1);
    const tech = selectQuestions({ topics: ['System Design'], difficulty: 'Medium', questionCount: 5, interviewType: 'Technical' });
    assert.ok(tech.every((q) => q.topic !== 'HR & Behavioral'));
  });

  test('fills from other topics when a topic runs out', () => {
    const picked = selectQuestions({ topics: ['Python Programming'], difficulty: 'Easy', questionCount: 8, interviewType: 'Technical' });
    assert.equal(picked.length, 8);
    assert.equal(picked.filter((q) => q.topic === 'Python Programming').length, 3);
  });
});

describe('AIServiceManager resilience', () => {
  const config = { targetRole: 'Backend Developer', topics: ['Operating Systems'], difficulty: 'Medium', interviewType: 'Technical', experienceLevel: 'Junior', questionCount: 3 };

  test('falls back to the bank when the provider throws', async () => {
    const manager = new AIServiceManager({
      primary: { name: 'broken', generateQuestions: async () => { throw new Error('boom'); }, evaluateAnswer: async () => { throw new Error('boom'); } },
    });
    const gen = await manager.generateQuestions(config);
    assert.equal(gen.questions.length, 3);
    assert.equal(gen.isFallback, true);
    const ev = await manager.evaluateAnswer({ ...base, candidateAnswer: STRONG });
    assert.equal(ev.isFallback, true);
    assert.ok(ev.overallScore > 50);
  });

  test('normalizes provider evaluations and tops up short question lists', async () => {
    const manager = new AIServiceManager({
      primary: {
        name: 'mock',
        generateQuestions: async () => ({
          provider: 'mock',
          isFallback: false,
          questions: [{ questionText: 'Explain paging in an operating system.', topic: 'Operating Systems', difficulty: 'Medium', type: 'Technical', referenceConcepts: [], evaluationCriteria: [] }],
        }),
        evaluateAnswer: async () => ({ criteriaScores: { technicalCorrectness: 80, relevance: 20, completeness: 20, clarity: 20 } }),
      },
    });
    const gen = await manager.generateQuestions(config);
    assert.equal(gen.questions.length, 3);
    assert.equal(gen.questions[0].questionText, 'Explain paging in an operating system.');
    const ev = await manager.evaluateAnswer({ ...base, candidateAnswer: 'x' });
    assert.equal(ev.overallScore, 100);
    assert.equal(ev.criteriaScores.technicalCorrectness, 40);
    assert.equal(ev.provider, 'mock');
  });

  test('fallback provider produces a complete evaluation shape', async () => {
    const raw = await new FallbackProvider().evaluateAnswer({ ...base, candidateAnswer: STRONG });
    for (const key of ['overallScore', 'criteriaScores', 'correctConcepts', 'missingConcepts', 'mistakes', 'feedback', 'improvedAnswer']) {
      assert.ok(key in raw, key);
    }
  });
});
