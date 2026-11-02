import { AIProvider } from './AIProvider.js';
import { FALLBACK_QUESTION_BANK } from './FallbackQuestionBank.js';
import { evaluateHeuristically } from './heuristicEvaluator.js';

const BEHAVIORAL_TOPIC = 'HR & Behavioral';

const DIFFICULTY_PREFERENCE = {
  Easy: ['Easy', 'Medium', 'Hard'],
  Medium: ['Medium', 'Easy', 'Hard'],
  Hard: ['Hard', 'Medium', 'Easy'],
};

const shuffle = (items, random = Math.random) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/** Questions for one topic, best difficulty match first, shuffled within each tier. */
const rankedForTopic = (bank, topic, difficulty, random) => {
  const order = DIFFICULTY_PREFERENCE[difficulty] || DIFFICULTY_PREFERENCE.Medium;
  return order.flatMap((d) => shuffle(bank.filter((x) => x.topic === topic && x.difficulty === d), random));
};

/** Round-robin across topics so every selected topic is represented. */
const pickRoundRobin = (bank, topics, difficulty, count, used, random) => {
  const queues = shuffle(topics, random).map((t) => rankedForTopic(bank, t, difficulty, random));
  const picked = [];
  let progress = true;
  while (picked.length < count && progress) {
    progress = false;
    for (const queue of queues) {
      while (queue.length) {
        const next = queue.shift();
        if (!used.has(next.questionText)) {
          used.add(next.questionText);
          picked.push(next);
          progress = true;
          break;
        }
      }
      if (picked.length >= count) break;
    }
  }
  return picked;
};

export const selectQuestions = (
  { topics = [], difficulty = 'Medium', questionCount = 5, interviewType = 'Technical', excludeTexts = [] },
  { bank = FALLBACK_QUESTION_BANK, random = Math.random } = {}
) => {
  const used = new Set(excludeTexts);
  const allTechnicalTopics = [...new Set(bank.map((x) => x.topic))].filter((t) => t !== BEHAVIORAL_TOPIC);
  const technicalTopics = topics.filter((t) => t !== BEHAVIORAL_TOPIC && allTechnicalTopics.includes(t));

  let behavioralCount = 0;
  if (interviewType === 'HR' || interviewType === 'Behavioral') behavioralCount = questionCount;
  else if (interviewType === 'Mixed') behavioralCount = questionCount >= 6 ? 2 : questionCount >= 2 ? 1 : 0;
  else if (topics.includes(BEHAVIORAL_TOPIC)) behavioralCount = Math.max(1, Math.round(questionCount / (topics.length || 1)));

  const technicalCount = questionCount - behavioralCount;
  const picked = [];

  if (technicalCount > 0) {
    const primary = technicalTopics.length ? technicalTopics : allTechnicalTopics;
    picked.push(...pickRoundRobin(bank, primary, difficulty, technicalCount, used, random));
    if (picked.length < technicalCount) {
      const others = allTechnicalTopics.filter((t) => !primary.includes(t));
      picked.push(...pickRoundRobin(bank, others, difficulty, technicalCount - picked.length, used, random));
    }
  }

  if (behavioralCount > 0) {
    // For HR-only interviews prefer HR-typed prompts; for Behavioral prefer STAR prompts.
    const pool = bank.filter((x) => x.topic === BEHAVIORAL_TOPIC);
    const typed = interviewType === 'HR' ? 'HR' : interviewType === 'Behavioral' ? 'Behavioral' : null;
    const ordered = [
      ...rankedForTopic(pool.filter((x) => !typed || x.type === typed), BEHAVIORAL_TOPIC, difficulty, random),
      ...rankedForTopic(pool.filter((x) => typed && x.type !== typed), BEHAVIORAL_TOPIC, difficulty, random),
    ];
    for (const item of ordered) {
      if (picked.length >= questionCount) break;
      if (!used.has(item.questionText)) {
        used.add(item.questionText);
        picked.push(item);
      }
    }
  }

  // Last resort: anything unused, so we always return the requested count when possible.
  if (picked.length < questionCount) {
    for (const item of shuffle(bank, random)) {
      if (picked.length >= questionCount) break;
      if (!used.has(item.questionText)) {
        used.add(item.questionText);
        picked.push(item);
      }
    }
  }

  return picked.slice(0, questionCount);
};

export class FallbackProvider extends AIProvider {
  constructor() {
    super('fallback');
  }

  async generateQuestions(config) {
    const selected = selectQuestions(config);
    return {
      questions: selected.map((item, idx) => ({
        orderIndex: idx,
        questionText: item.questionText,
        topic: item.topic,
        difficulty: item.difficulty,
        type: item.type,
        referenceConcepts: item.referenceConcepts,
        evaluationCriteria: item.evaluationCriteria,
      })),
      provider: 'fallback',
      isFallback: true,
      message: 'Generated from the curated offline question bank.',
    };
  }

  async evaluateAnswer(data) {
    return evaluateHeuristically(data);
  }
}
