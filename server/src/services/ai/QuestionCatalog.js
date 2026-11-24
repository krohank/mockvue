import { createHash } from 'node:crypto';
import { FALLBACK_QUESTION_BANK } from './FallbackQuestionBank.js';
import { EXTRA_QUESTIONS } from './ExtraQuestions.js';
import { ANSWER_GUIDES } from './AnswerGuides.js';
import { PRACTICE_QUESTIONS } from './PracticeQuestions.js';
const original = [...FALLBACK_QUESTION_BANK, ...EXTRA_QUESTIONS];
const corrections = {
  0: { questionText: 'How do two-pointer algorithms find two values with a target sum in a sorted array? Explain why each pointer move is safe and compare complexity with checking all pairs.', referenceConcepts: ['sorted array invariant', 'move left when sum is small', 'move right when sum is large', 'linear time and constant space', 'sorting cost for unsorted input'] },
  1: { questionText: 'Explain internal hash collisions in Java’s OpenJDK HashMap. When can a linked bucket become a tree, and how does table capacity affect that decision?', referenceConcepts: ['collision chaining', 'hash and equality', 'treeify threshold 8', 'minimum capacity 64', 'resize before treeifying a small table'] },
  7: { questionText: 'Describe the four necessary conditions for a deadlock. How does prevention differ from Banker’s algorithm for avoiding unsafe allocations?' },
  8: { referenceConcepts: ['page table translation', 'TLB hit and miss', 'mapping or permission fault', 'demand paging', 'copy on write'] },
  11: { questionText: 'Design a URL Shortening service. Explain unique short-code allocation, Base62 encoding, collision handling, caching, and redirect behaviour.' },
  12: { referenceConcepts: ['consistency during a partition', 'latency and consistency tradeoff', 'quorum overlap', 'concurrent writes', 'database specific guarantees'] },
  14: { questionText: 'Describe a technical decision where you and a teammate preferred different approaches. What evidence did you compare, and what changed after the decision?' },
  40: { questionText: 'How would you choose between threads, separate processes, and explicit inter-process communication for a worker service?', referenceConcepts: ['address space isolation', 'shared memory synchronization', 'fault isolation', 'inter process communication'] },
  41: { questionText: 'How do deadlock prevention, avoidance, and detection differ? Give a suitable policy for a shared-resource service.', referenceConcepts: ['lock ordering', 'safe allocation state', 'cycle detection', 'recovery policy'] },
};
const key = (text) => String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
const curated = original.map((q, i) => {
  const guide = ANSWER_GUIDES[i];
  if (!guide || !key(q.questionText).includes(key(guide[0]))) throw new Error('Mismatched worked answer at bank index ' + i);
  return { ...q, ...corrections[i], referenceAnswer: guide[1], legacyText: q.questionText };
});
export const QUESTION_BANK = [...curated, ...PRACTICE_QUESTIONS].map((q) => ({
  ...q, bankId: 'bank-' + createHash('sha256').update(q.legacyText || q.questionText).digest('hex').slice(0, 16), answerSource: 'curated',
  followUpQuestions: q.followUpQuestions || ['Give a concrete example and walk through it.', 'Which assumption could fail, and how would you handle that case?'],
}));
export const SUPPORTED_TOPICS = [...new Set(QUESTION_BANK.map((q) => q.topic))];
const byId = new Map(QUESTION_BANK.map((q) => [q.bankId, q]));
const byText = new Map(QUESTION_BANK.flatMap((q) => [[key(q.questionText), q], [key(q.legacyText || q.questionText), q]]));
export const findBankQuestion = ({ bankId, questionText }) => byId.get(bankId) || byText.get(key(questionText));
const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
};
export function selectBankQuestions({ topics = [], difficulty = 'Medium', questionCount = 5, interviewType = 'Technical', recentQuestionTexts = [] }) {
  const pool = QUESTION_BANK.filter((q) => q.difficulty === difficulty && (
    ['HR', 'Behavioral'].includes(interviewType) ? q.type === interviewType : q.type === 'Technical' ? topics.includes(q.topic) : interviewType === 'Mixed'));
  const recent = new Set(recentQuestionTexts.map(key));
  const groups = new Map();
  for (const q of pool) { const group = q.type === 'Technical' ? q.topic : q.type; if (!groups.has(group)) groups.set(group, []); groups.get(group).push(q); }
  const queues = shuffle([...groups.values()]).map((list) => {
    const shuffled = shuffle(list);
    return [...shuffled.filter((q) => !recent.has(key(q.questionText))), ...shuffled.filter((q) => recent.has(key(q.questionText)))];
  });
  const selected = [];
  while (selected.length < questionCount && queues.some((q) => q.length)) {
    for (const queue of queues) if (queue.length && selected.length < questionCount) selected.push(queue.shift());
  }
  const notices = [];
  if (selected.length < questionCount) notices.push(`This selection has ${pool.length} distinct ${difficulty} questions. The session uses ${selected.length}; choose more topics for a longer session.`);
  if (selected.some((q) => recent.has(key(q.questionText)))) notices.push('Some questions repeat recent practice because this selection has a limited pool.');
  if (groups.size > questionCount) notices.push('There are more selected topics than questions; this session cannot cover every topic.');
  return { questions: selected.map(({ legacyText, ...q }, orderIndex) => ({ ...q, orderIndex })), provider: 'fallback', isFallback: true, message: notices.join(' ') || null, availableCount: pool.length };
}
