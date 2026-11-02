/**
 * Offline rubric evaluator used when no LLM is configured (or it fails).
 *
 * It cannot judge factual correctness the way a model can, so it measures what
 * it can measure reliably: coverage of the question's reference concepts,
 * overlap with the question itself, depth signals (complexity, examples,
 * trade-offs), structure, and answer quality (length, real words, repetition).
 * Pure function — no I/O — so it is fully unit-tested.
 */

const STOPWORDS = new Set(
  `a an the and or but if then else of to in on at by for with from as is are was were be been being this that these those it its
  into over under than so such can could would should will shall may might must do does did done have has had having not no yes
  i me my we our you your he she they them their his her what which who whom whose when where why how all any both each few more
  most other some own same very just also only about above below up down out off again further once here there each per via
  using use used e g eg ie etc like one two get gets got make makes made way ways thing things lot lots really basically actually`
    .split(/\s+/)
    .filter(Boolean)
);

// Words that describe the *task* rather than the subject matter.
const QUESTION_FILLER = new Set(
  'explain describe discuss compare contrast detail details difference differences between what why how would you your give example examples walk through trace tell time when versus vs'.split(
    ' '
  )
);

const STRUCTURE_MARKERS = [
  'because', 'therefore', 'however', 'whereas', 'while', 'first', 'second', 'third', 'finally', 'for example',
  'for instance', 'such as', 'in contrast', 'trade-off', 'tradeoff', 'trade off', 'on the other hand', 'which means',
  'as a result', 'so that', 'instead', 'unlike', 'otherwise', 'in practice', 'the downside', 'the benefit',
];

const EXAMPLE_MARKERS = ['for example', 'for instance', 'e.g', 'such as', 'consider', 'imagine', 'in my project', 'suppose'];

const STAR_MARKERS = {
  situation: ['situation', 'context', 'background', 'at my', 'during my', 'when i was', 'in my internship', 'in my project', 'our team'],
  task: ['task', 'goal', 'responsible', 'my role', 'needed to', 'had to', 'objective', 'challenge'],
  action: ['i decided', 'i built', 'i led', 'i proposed', 'i wrote', 'i talked', 'i organized', 'i created', 'i set up', 'i scheduled', 'i reached out', 'i suggested', 'i implemented', 'action'],
  result: ['result', 'outcome', 'as a result', 'reduced', 'improved', 'increased', 'learned', 'delivered', 'shipped', '%', 'percent'],
};

const TARGET_WORDS = { Easy: 50, Medium: 80, Hard: 110 };

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const tokenize = (text) => (String(text || '').toLowerCase().match(/[a-z0-9+#]+(?:['-][a-z0-9]+)*/g) || []);

export const stem = (word) => {
  let w = word.replace(/'s$/, '');
  if (w.length <= 4) return w;
  for (const suffix of ['ations', 'ation', 'tions', 'tion', 'ings', 'ing', 'ness', 'ments', 'ment', 'ities', 'ity', 'ies', 'ied', 'ers', 'er', 'ed', 'es', 'ly', 's', 'y']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
};

const contentStems = (text) =>
  tokenize(text)
    .filter((t) => !STOPWORDS.has(t) && (t.length >= 2 || /\d/.test(t)))
    .map(stem);

const looksLikeWord = (token) => {
  if (/^\d+$/.test(token)) return true;
  if (token.length <= 3) return true;
  if (!/[aeiouy]/.test(token)) return false;
  return !/[bcdfghjklmnpqrstvwxz]{5,}/.test(token);
};

const stemMatches = (keyword, answerStems) => {
  if (answerStems.has(keyword)) return true;
  if (keyword.length < 6) return false;
  const prefix = keyword.slice(0, keyword.length - 1);
  for (const s of answerStems) {
    if (s.length >= 6 && (s.startsWith(prefix) || keyword.startsWith(s.slice(0, s.length - 1)))) return true;
  }
  return false;
};

const countMarkers = (lowerText, markers) => markers.reduce((n, m) => n + (lowerText.includes(m) ? 1 : 0), 0);

/** Coverage (0..1) of a single reference concept by the answer. */
export const conceptCoverage = (concept, answerStems, answerLowerRaw) => {
  const acronyms = (String(concept).match(/\b[A-Z][A-Z0-9]{1,6}\b/g) || []).map((a) => a.toLowerCase());
  const answerTokens = new Set(tokenize(answerLowerRaw));
  if (acronyms.some((a) => answerTokens.has(a))) return 1;

  const words = tokenize(concept).filter((t) => !STOPWORDS.has(t));
  if (words.length >= 3) {
    const initials = words.map((w) => w[0]).join('');
    if (initials.length >= 3 && answerTokens.has(initials)) return 1;
  }

  const keywords = [...new Set(words.filter((t) => t.length >= 2 || /\d/.test(t)).map(stem))];
  if (keywords.length === 0) return 0;
  const hits = keywords.filter((k) => stemMatches(k, answerStems)).length;
  return hits / keywords.length;
};

export const analyzeAnswer = ({ questionText = '', referenceConcepts = [], candidateAnswer = '', type = 'Technical' }) => {
  const answer = String(candidateAnswer || '').trim();
  const lower = answer.toLowerCase();
  const tokens = tokenize(answer);
  const words = tokens.length;
  const content = tokens.filter((t) => !STOPWORDS.has(t));
  const answerStems = new Set(content.map(stem));

  const perConcept = referenceConcepts.map((concept) => ({
    concept,
    coverage: conceptCoverage(concept, answerStems, lower),
  }));
  const questionStems = [...new Set(contentStems(questionText).filter((s) => !QUESTION_FILLER.has(s)))];
  const questionOverlap = questionStems.length
    ? questionStems.filter((s) => stemMatches(s, answerStems)).length / questionStems.length
    : 0;

  const isBehavioral = type === 'Behavioral' || type === 'HR';
  const starHits = Object.fromEntries(
    Object.entries(STAR_MARKERS).map(([k, markers]) => [k, countMarkers(lower, markers) > 0])
  );
  const starFraction = Object.values(starHits).filter(Boolean).length / 4;

  // Behavioral reference concepts are meta-labels ("STAR method"); judge them by structure.
  if (isBehavioral) {
    for (const c of perConcept) {
      if (/\bstar\b/i.test(c.concept)) c.coverage = Math.max(c.coverage, starFraction);
    }
  }
  const covered = perConcept.filter((c) => c.coverage >= 0.5).map((c) => c.concept);
  const missing = perConcept.filter((c) => c.coverage < 0.5).map((c) => c.concept);

  const conceptCoverageAvg = perConcept.length
    ? perConcept.reduce((sum, c) => sum + Math.min(1, c.coverage), 0) / perConcept.length
    : questionOverlap;
  const coverage = isBehavioral ? 0.4 * conceptCoverageAvg + 0.6 * starFraction : conceptCoverageAvg;

  const sentences = answer.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().split(/\s+/).length >= 3);
  const avgSentenceLength = sentences.length ? words / sentences.length : words;
  const uniqueRatio = content.length ? new Set(content).size / content.length : 0;
  const validWordRatio = tokens.length ? tokens.filter(looksLikeWord).length / tokens.length : 0;

  const structureMarkers = countMarkers(lower, STRUCTURE_MARKERS);
  const hasExample = countMarkers(lower, EXAMPLE_MARKERS) > 0;
  const hasComplexity = /\bo\s*\(\s*[^)]{1,15}\)/i.test(answer) || /\b(constant|linear|logarithmic|quadratic) time\b/i.test(answer);
  const hasNumbers = /\d/.test(answer);

  return {
    words,
    sentences: sentences.length,
    avgSentenceLength,
    uniqueRatio,
    validWordRatio,
    structureMarkers,
    hasExample,
    hasComplexity,
    hasNumbers,
    starHits,
    isBehavioral,
    coverage,
    questionOverlap,
    covered,
    missing,
  };
};

export const scoreAnswer = (analysis, difficulty = 'Medium') => {
  const a = analysis;

  // Quality gate: short, non-word, or repetitive answers cannot score well.
  let quality = 1;
  if (a.words < 8) quality *= 0.35;
  else if (a.words < 20) quality *= 0.7;
  if (a.validWordRatio < 0.6) quality *= 0.3;
  if (a.words >= 20 && a.uniqueRatio < 0.35) quality *= 0.4;
  if (a.words === 0) quality = 0;

  const lengthAdequacy = clamp01(a.words / (TARGET_WORDS[difficulty] || 80));

  const depth = a.isBehavioral
    ? clamp01(Object.values(a.starHits).filter(Boolean).length / 4 + (a.hasNumbers ? 0.15 : 0))
    : clamp01((a.hasComplexity ? 0.4 : 0) + Math.min(0.4, a.structureMarkers * 0.1) + (a.hasExample ? 0.2 : 0) + (a.hasNumbers ? 0.1 : 0));

  const relevanceRaw = 0.5 * a.questionOverlap + 0.5 * a.coverage;

  const technical = 40 * quality * clamp01(0.75 * a.coverage + 0.15 * depth + 0.1 * lengthAdequacy);
  const relevance = a.words < 3 ? 0 : 20 * quality * clamp01(0.15 + 0.45 * a.questionOverlap + 0.4 * a.coverage);
  const completeness = 20 * quality * clamp01(0.7 * a.coverage + 0.3 * lengthAdequacy);

  const sentenceScore = a.sentences >= 2 ? (a.avgSentenceLength >= 8 && a.avgSentenceLength <= 35 ? 1 : 0.6) : 0.3;
  const structureScore = clamp01(a.structureMarkers / 3);
  const diversityScore = clamp01((a.uniqueRatio - 0.3) / 0.4);
  const onTopic = 0.5 + 0.5 * clamp01(relevanceRaw * 2);
  const clarity = 20 * quality * onTopic * clamp01(0.3 + 0.25 * sentenceScore + 0.25 * structureScore + 0.2 * diversityScore);

  return {
    technicalCorrectness: Math.round(technical),
    relevance: Math.round(relevance),
    completeness: Math.round(completeness),
    clarity: Math.round(clarity),
    lengthAdequacy,
  };
};

const buildOutline = ({ questionText, referenceConcepts, evaluationCriteria, isBehavioral }) => {
  if (isBehavioral) {
    return [
      '1) Situation — one or two sentences of context: where you were and what was at stake.',
      '2) Task — your specific responsibility or goal.',
      `3) Action — the concrete steps you personally took${referenceConcepts.length ? `, showing ${referenceConcepts.slice(0, 3).join(', ')}` : ''}.`,
      '4) Result — a measurable outcome (time saved, bug count, % improvement) and what you learned.',
    ].join('\n');
  }
  const steps = [`Open with a direct one-line answer to: "${questionText.slice(0, 160)}${questionText.length > 160 ? '…' : ''}"`];
  if (referenceConcepts.length) steps.push(`Explain the key mechanisms: ${referenceConcepts.join('; ')}.`);
  if (evaluationCriteria.length) steps.push(`Make sure you address: ${evaluationCriteria.join('; ')}.`);
  steps.push('Close with a trade-off, complexity bound, or a concrete real-world example.');
  return steps.map((step, i) => `${i + 1}) ${step}`).join('\n');
};

export const evaluateHeuristically = (data) => {
  const {
    questionText = '',
    referenceConcepts = [],
    evaluationCriteria = [],
    candidateAnswer = '',
    topic = '',
    difficulty = 'Medium',
    type = 'Technical',
  } = data || {};

  const analysis = analyzeAnswer({ questionText, referenceConcepts, candidateAnswer, type });
  const scores = scoreAnswer(analysis, difficulty);
  const criteriaScores = {
    technicalCorrectness: scores.technicalCorrectness,
    relevance: scores.relevance,
    completeness: scores.completeness,
    clarity: scores.clarity,
  };
  const overallScore = Object.values(criteriaScores).reduce((x, y) => x + y, 0);
  const targetWords = TARGET_WORDS[difficulty] || 80;

  const gaps = [];
  if (analysis.words < 8) gaps.push('The answer is too short to demonstrate understanding.');
  else if (scores.lengthAdequacy < 0.5) gaps.push(`The answer is brief (${analysis.words} words); a ${difficulty.toLowerCase()} question usually needs ${targetWords}+ words.`);
  if (analysis.validWordRatio < 0.6 && analysis.words > 0) gaps.push('Much of the text is not recognizable words.');
  if (analysis.missing.length) gaps.push(`Did not address: ${analysis.missing.slice(0, 3).join('; ')}.`);
  if (!analysis.isBehavioral && !analysis.hasExample && analysis.words >= 20) gaps.push('No concrete example or scenario was given.');
  if (analysis.isBehavioral && !analysis.starHits.result) gaps.push('The outcome or result of your actions is not stated.');

  const tips = [];
  if (overallScore >= 80) tips.push('Strong answer — it is accurate in coverage and well structured.');
  if (analysis.missing.length) tips.push(`Cover these explicitly next time: ${analysis.missing.join(', ')}.`);
  if (scores.lengthAdequacy < 0.6 && analysis.words >= 8) tips.push(`Go deeper — aim for about ${targetWords} words with one worked example.`);
  if (analysis.structureMarkers === 0 && analysis.words >= 20) tips.push('Signpost your reasoning: definition → how it works → trade-offs → example.');
  if (!analysis.isBehavioral && !analysis.hasComplexity && /algorithm|data structure|database|index|sort|search|graph|tree|hash/i.test(`${topic} ${questionText}`)) {
    tips.push('State the time and space complexity where relevant.');
  }
  if (analysis.isBehavioral && Object.values(analysis.starHits).filter(Boolean).length < 3) {
    tips.push('Use the STAR structure: Situation, Task, Action, Result — with a measurable result.');
  }
  if (tips.length === 0) tips.push('Solid answer. Add a trade-off discussion to make it complete.');

  return {
    overallScore,
    criteriaScores,
    correctConcepts: analysis.covered,
    missingConcepts: analysis.missing,
    mistakes: gaps,
    explanation: `Offline rubric evaluation: covered ${analysis.covered.length} of ${referenceConcepts.length} key concepts in ${analysis.words} words. Configure an AI provider for full semantic grading.`,
    feedback: tips.slice(0, 3).join(' '),
    improvedAnswer: buildOutline({ questionText, referenceConcepts, evaluationCriteria, isBehavioral: analysis.isBehavioral }),
    recommendedTopics: overallScore < 70 && topic ? [topic] : [],
    isFallback: true,
  };
};
