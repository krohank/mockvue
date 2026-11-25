import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_BANK } from '../src/services/ai/QuestionCatalog.js';
import { gradeAnswer, RULE_VERSION } from '../src/services/ai/LocalRubricGrader.js';
import { RuleBasedProvider } from '../src/services/ai/RuleBasedProvider.js';
import { AIServiceManager } from '../src/services/ai/AIProviderFactory.js';
import { normalizeEvaluation } from '../src/services/ai/evaluation.js';
import { hasScoredRubric, summarizeScore } from '../src/services/scoreSummary.js';

const score = (q, text) => gradeAnswer({ ...q, candidateAnswer: text }).overallScore;
const bank = (re) => QUESTION_BANK.find((q) => re.test(q.questionText));
const technical = QUESTION_BANK.filter((q) => q.type === 'Technical');
const filler = 'I really enjoy spending time outdoors because the weather is pleasant and the people around me are friendly, so I usually go for a long walk and then cook dinner at home with my family.';

test('every one of the bank questions can be scored; none is left ungraded', () => {
  assert.ok(QUESTION_BANK.length >= 139);
  for (const q of QUESTION_BANK) {
    const result = gradeAnswer({ ...q, candidateAnswer: q.referenceAnswer });
    assert.ok(result && Number.isInteger(result.overallScore) && result.overallScore >= 0 && result.overallScore <= 100, q.questionText);
    assert.equal(result.provider, 'rules'); assert.equal(result.isFallback, false); assert.equal(result.rubricVersion, RULE_VERSION);
    assert.ok(result.rubricResults.length >= 2, q.questionText);
  }
});

test('the saved answer, restated, earns a high technical score and unrelated text earns almost nothing', () => {
  for (const q of technical) {
    assert.ok(score(q, q.referenceAnswer) >= 70, 'saved answer should match itself: ' + q.questionText);
    assert.ok(score(q, filler) <= 10, 'unrelated text must not score: ' + q.questionText);
  }
});

test('a list of bare terms cannot earn a high score', () => {
  const stop = /^(a|an|the|and|or|of|to|in|on|at|by|for|from|with|is|are|when|than|before|after|into)$/;
  for (const q of technical) {
    const salad = q.referenceConcepts.join(' ').toLowerCase().split(/\s+/).filter((w) => !stop.test(w)).join(' ');
    assert.ok(score(q, salad) <= 50, 'keyword salad scored too high: ' + q.questionText);
  }
});

test('another question\'s worked answer is rarely accepted', () => {
  let high = 0;
  technical.forEach((q, i) => { if (score(q, technical[(i + 37) % technical.length].referenceAnswer) > 40) high++; });
  assert.ok(high <= technical.length * 0.06, high + ' cross-question answers scored above 40');
});

test('a correct but incomplete answer gets partial, evidence-based credit', () => {
  const q = bank(/transactions protect an order/i);
  const result = gradeAnswer({ ...q, candidateAnswer: 'A transaction groups changes across tables into one operation. If all changes succeed, it commits; if any fail, it rolls back, preventing incomplete orders and keeping data consistent.' });
  assert.ok(result.overallScore >= 55 && result.overallScore <= 80, String(result.overallScore));
  assert.deepEqual(result.correctConcepts.sort(), ['atomicity', 'consistency', 'rollback']);
  assert.deepEqual(result.missingConcepts.sort(), ['durability', 'isolation']);
  assert.ok(result.rubricResults.find((r) => r.point === 'rollback').evidence.includes('rolls back'));
  assert.match(result.feedback, /3 of 5 key concepts/);
  assert.match(result.explanation, /No AI model is used/);
});

test('a complete answer in different wording scores well, a vague one does not', () => {
  const q = bank(/two-pointer/i);
  const strong = 'Put one pointer at each end of the sorted array. If the sum is smaller than the target, move the left pointer right; if it is larger, move the right pointer left. Each pointer moves one way, so it takes O(n) time and O(1) space, compared with O(n^2) for checking all pairs. Unsorted input has to be sorted first, which costs O(n log n).';
  assert.ok(score(q, strong) >= 85);
  assert.ok(score(q, 'Use two pointers on a sorted array and move them depending on whether the sum is too big or too small. It is O(n).') > score(q, 'You loop over the array and check pairs until you find the sum.'));
  assert.ok(score(q, 'You loop over the array and check pairs until you find the sum.') <= 15);
});

test('known false claims are flagged and cost marks, but rejecting them does not', () => {
  const q = bank(/two-pointer/i);
  const wrong = gradeAnswer({ ...q, candidateAnswer: 'Two pointers work on any unsorted array. You randomly move the pointers, and it does not need sorting at all.' });
  assert.ok(wrong.mistakes.length >= 1 && wrong.overallScore <= 20);
  const hash = bank(/hash collisions in Java/i);
  assert.deepEqual(gradeAnswer({ ...hash, candidateAnswer: hash.referenceAnswer }).mistakes, []);
});

test('empty and one-word answers score zero with an explanation', () => {
  const q = bank(/two-pointer/i);
  for (const text of ['', '   ', 'idk', 'sorted']) {
    const result = gradeAnswer({ ...q, candidateAnswer: text });
    assert.equal(result.overallScore, 0); assert.match(result.feedback, /too short/i);
  }
});

test('behavioral answers are scored on story structure, and a structured story beats a vague one', () => {
  const q = bank(/learned something from feedback/i);
  const story = 'In my second-year project my mentor reviewed my pull request and pointed out that my functions were too long and untested. I wrote unit tests for the main modules and split the code into smaller functions over the next week. After that, review comments dropped and the next feature merged without rework. I learned to ask for review early.';
  const vague = 'I always take feedback positively and learn from it.';
  const result = gradeAnswer({ ...q, candidateAnswer: story });
  assert.ok(result.overallScore >= 50 && score(q, vague) <= 20);
  assert.match(result.explanation, /cannot verify that your story is true/);
});

test('the rules provider output passes validation and counts as a real score everywhere', async () => {
  const q = bank(/transactions protect an order/i);
  const evaluation = normalizeEvaluation(await new RuleBasedProvider().evaluateAnswer({ ...q, candidateAnswer: 'Transactions commit all changes together or roll them back, which keeps data consistent.' }));
  const stored = { ...evaluation, evaluationStatus: 'completed', evaluationProvider: 'rules', isFallbackEvaluation: false };
  assert.ok(hasScoredRubric(stored));
  assert.equal(summarizeScore([stored], 1).scoreStatus, 'graded');
  const status = await new AIServiceManager({ AI_PROVIDER: 'rules' }).status();
  assert.equal(status.available, true); assert.equal(status.apiKeyRequired, false); assert.equal(status.effectiveProvider, 'rules');
});

test('questions whose hand-written rubric no longer lines up with their concepts are still scored', () => {
  for (const re of [/ANSI SQL transaction isolation/i, /https:\/\/google\.com/i]) {
    const q = bank(re);
    assert.ok(score(q, q.referenceAnswer) >= 60, q.questionText);
  }
});

test('every technical question has an authored rubric rule for each reference concept', async () => {
  const { getRuleRubric } = await import('../src/services/ai/RuleRubrics.js');
  for (const q of technical) {
    const rubric = getRuleRubric(q);
    assert.ok(rubric, 'no authored rubric for: ' + q.questionText);
    assert.equal(rubric.length, q.referenceConcepts.length, q.questionText);
  }
});
