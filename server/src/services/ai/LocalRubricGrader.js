import { QUESTION_BANK, findBankQuestion } from './QuestionCatalog.js';
import { getRuleRubric } from './RuleRubrics.js';
import { MISCONCEPTIONS } from './Misconceptions.js';

/**
 * Local rubric grader. No language model, no network, no API key.
 *
 * Every saved answer in the question bank is turned into a rubric:
 *   - one point per reference concept (short, specific ideas), and
 *   - one point per sentence of the saved worked answer (supporting detail).
 * The candidate's answer is compared with those points using stemmed key terms,
 * a small synonym table and inverse-document-frequency weights, so common words
 * count for little and distinctive technical terms count for a lot. Hand-written
 * regular-expression rubrics (RuleRubrics) and known-misconception rules
 * (Misconceptions) are layered on top when they exist for the question.
 *
 * It is an estimate of overlap with the saved answer, not a proof of correctness.
 */
export const RULE_VERSION = 'local-rubric-v2';

const ASSERTION = /\b(is|are|means?|ensures?|guarantees?|allows?|prevents?|protects?|preserves?|maintains?|uses?|keeps?|stores?|takes?|runs?|returns?|compares?|discards?|moves?|increases?|decreases?|saves?|restores?|checks?|validates?|rejects?|groups?|combines?|commits?|rolls?|fails?|succeeds?|reverts?|persists?|survives?|reduces?|removes?|shares?|provides?|supports?|avoids?|requires?|creates?|adds?|finds?|tracks?|updates?|handles?|releases?|waits?|blocks?|limits?|processes?|reads?|writes?|chooses?|choose|use|keep|store|compare|discard|move|save|restore|check|validate|reject|commit|rollback|reduce|remove|share|avoid|create|find|track|update|handle|release|wait|block|limit|process|read|write|inject|filter|sort|count|calculate|derive|represent|assign|cancel|propagate|offload|insert|delete|define|split|replay|enforce|yield|match|include|exclude|throw|catch|close|open|stop|start|drain|queue|select|replace|test|measure|inspect|coordinate|detect|schedule|settle|relax|compute|append|decrement|increment|deliver|retry|backfill|refill|consume|distribute|route|isolate|confirm|apply|rebase|resolve|reconcile|expire|reorder|copy|mutate|wrap|intercept|depend|implement|inherit|substitute|construct|reassign|convert|coerce|halves?)\b/i;
const NARRATIVE = /\b(?:i|we|they|he|she|it|you)\s+(?:\w+ed|was|were|had|did|got|made|took|wrote|built|ran|told|saw|found|went|began|chose|said|gave|kept|put|sat)\b/i;
const wellFormed = (plain) => ASSERTION.test(plain) || NARRATIVE.test(plain);

const FUNCTION_WORDS = new Set(('a an the and or but if then else of to in on at by for from with without into onto over under about as is are was were be been being am do does did done have has had having it its this that these those there their they them he she we you your our i me my not no nor so than too very can could should would will shall may might must which what when where who how why while during after before between both either via per').split(' '));
const STOP = new Set([...FUNCTION_WORDS, ...('also just only more most some any each every other such one two three first second thus hence however because since although though yet still even much many few lot like get gets got make makes made given give gives using use used uses way ways thing things').split(' ')]);

// First entry of each group is the canonical token every other phrase maps to.
const SYNONYMS = [
  ['atomicity', 'atomic', 'all or nothing', 'indivisible', 'single unit of work', 'single unit', 'one unit', 'one operation', 'single operation', 'one logical operation', 'together or not at all'],
  ['rollback', 'roll back', 'rolled back', 'rolls back', 'rolling back', 'revert', 'reverts', 'reverted', 'undo', 'undone', 'abort', 'aborts', 'aborted'],
  ['durability', 'durable', 'persist', 'persists', 'persisted', 'permanent', 'permanently', 'survive a crash', 'survives a crash', 'survive crash', 'survives crash', 'survive restart', 'written to disk'],
  ['consistency', 'consistent', 'integrity', 'valid state', 'invariant', 'invariants', 'constraint', 'constraints'],
  ['isolation', 'isolate', 'isolated', 'isolates', 'concurrently', 'concurrent', 'concurrency', 'simultaneous', 'simultaneously'],
  ['lineartime', 'linear time', 'linear'],
  ['logtime', 'logarithmic', 'log n', 'logn', 'log time'],
  ['constanttime', 'constant time', 'constant'],
  ['quadratictime', 'quadratic', 'n squared'],
  ['nlogn', 'n log n', 'linearithmic'],
  ['onepass', 'one pass', 'single pass', 'single scan', 'one scan'],
  ['twopass', 'two pass', 'two passes', 'second pass'],
  ['twopointer', 'two pointer', 'two pointers', 'left and right pointer', 'left and right pointers'],
  ['hashtable', 'hash table', 'hash map', 'hashmap', 'dictionary', 'dict'],
  ['sorted', 'sort', 'sorts', 'sorting', 'ordered', 'ascending', 'descending'],
  ['bfs', 'breadth first', 'breadth first search'],
  ['dfs', 'depth first', 'depth first search'],
  ['dynamicprogramming', 'dynamic programming', 'dp'],
  ['memoization', 'memoize', 'memoized', 'memoise', 'memoised', 'memo'],
  ['collision', 'collisions', 'collide', 'collides', 'colliding'],
  ['heap', 'heaps', 'priority queue'],
  ['recursion', 'recursive', 'recursively', 'calls itself', 'call itself'],
  ['iteration', 'iterative', 'iteratively', 'loop', 'loops', 'looping'],
  ['immutable', 'immutability', 'unchangeable', 'cannot be modified', 'cannot be changed'],
  ['database', 'databases', 'db', 'datastore', 'data store'],
  ['index', 'indexes', 'indices', 'indexing', 'indexed'],
  ['latency', 'delay', 'response time'],
  ['scalability', 'scalable', 'scale', 'scaling', 'horizontal scaling'],
  ['replica', 'replicas', 'replication', 'replicate', 'replicated'],
  ['shard', 'shards', 'sharding', 'sharded'],
  ['retry', 'retries', 'retried', 'retrying', 'backoff', 'back off'],
  ['idempotent', 'idempotency', 'idempotence', 'safe to repeat', 'repeat safely'],
  ['async', 'asynchronous', 'asynchronously', 'non blocking', 'nonblocking'],
  ['sync', 'synchronous', 'synchronously', 'blocking'],
  ['validate', 'validation', 'validates', 'validated', 'verify', 'verifies', 'verified', 'sanitize', 'sanitise', 'sanitization'],
  ['authentication', 'authenticate', 'authenticated', 'login', 'log in', 'sign in'],
  ['authorization', 'authorize', 'authorized', 'permission', 'permissions', 'access control'],
  ['encryption', 'encrypt', 'encrypted', 'encrypts', 'cipher'],
  ['tradeoff', 'trade off', 'tradeoffs', 'trade offs'],
  ['abstraction', 'abstract', 'abstracts', 'abstracted'],
  ['inheritance', 'inherit', 'inherits', 'inherited', 'subclass'],
  ['encapsulation', 'encapsulate', 'encapsulates', 'information hiding', 'hide internal', 'hides internal'],
  ['deadlock', 'deadlocks', 'deadlocked'],
  ['racecondition', 'race condition', 'race conditions', 'data race', 'data races'],
  ['threadsafe', 'thread safe', 'thread safety'],
  ['loadbalancer', 'load balancer', 'load balancers', 'load balancing', 'load balance'],
  ['microservice', 'microservices', 'micro service', 'micro services'],
  ['callback', 'callbacks', 'call back'],
  ['gc', 'garbage collection', 'garbage collector'],
  ['contextswitch', 'context switch', 'context switching', 'context switches'],
  ['debounce', 'debouncing', 'debounced'],
  ['throttle', 'throttling', 'throttled'],
  ['ssl', 'tls'],
  ['cdn', 'content delivery network'],
  ['dns', 'domain name system'],
  ['normalization', 'normalize', 'normalise', 'normalized', 'normalised'],
  ['denormalization', 'denormalize', 'denormalise', 'denormalized', 'denormalised'],
];
const PHRASES = SYNONYMS.flatMap(([canon, ...others]) => others.map((phrase) => [phrase, canon]))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([phrase, canon]) => [new RegExp('\\b' + phrase.replace(/ /g, '\\s+') + '\\b', 'g'), canon]);

const SUFFIXES = [['bility', 8, 'bl'], ['ization', 9, ''], ['isation', 9, ''], ['ational', 9, ''], ['ation', 7, 'at'], ['ition', 7, 'it'], ['ments', 8, ''], ['ment', 7, ''],
  ['ness', 7, ''], ['ingly', 8, ''], ['edly', 7, ''], ['ing', 6, ''], ['ions', 6, ''], ['ion', 6, ''], ['ity', 6, ''], ['ency', 7, ''], ['ance', 7, ''], ['ence', 7, ''],
  ['ent', 7, ''], ['ant', 7, ''], ['ally', 7, ''], ['ly', 6, ''], ['ed', 5, ''], ['ers', 6, ''], ['er', 6, ''], ['al', 6, ''], ['ive', 6, ''], ['ous', 6, ''], ['ic', 6, '']];
export function stem(word) {
  let w = word;
  if (/^\d+$/.test(w) || w.length <= 3) return w;
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies') && w.length > 4) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  for (let pass = 0; pass < 2; pass++) {
    const rule = SUFFIXES.find(([suffix, min]) => w.length >= min && w.endsWith(suffix));
    if (!rule) break;
    w = w.slice(0, -rule[0].length) + rule[2];
  }
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

// Text as the hand-written rubric rules expect it.
const normalizePlain = (text) => String(text || '').normalize('NFKC').toLowerCase()
  .replace(/[’‘]/g, "'").replace(/[–—-]/g, ' ').replace(/\b(can't|cannot)\b/g, 'can not')
  .replace(/\b(doesn't|don't|isn't|aren't|won't)\b/g, (s) => ({ "doesn't": 'does not', "don't": 'do not', "isn't": 'is not', "aren't": 'are not', "won't": 'will not' }[s]))
  .replace(/\s+/g, ' ').trim();

// Text as the key-term matcher sees it: big-O forms and synonyms are canonicalised.
function canonicalText(text) {
  let t = normalizePlain(text)
    .replace(/o\s*\(\s*n\s*(?:\^|\*\*)\s*2\s*\)|o\s*\(\s*n²\s*\)|o\s*\(\s*n\s*squared\s*\)/g, ' quadratictime ')
    .replace(/o\s*\(\s*n\s*log\s*\(?\s*n\s*\)?\s*\)/g, ' nlogn ')
    .replace(/o\s*\(\s*log\s*\(?\s*[nk]\s*\)?\s*\)/g, ' logtime ')
    .replace(/o\s*\(\s*1\s*\)/g, ' constanttime ')
    .replace(/o\s*\(\s*[nkmv]\s*(?:\+\s*[nkmve]\s*)?\)/g, ' lineartime ')
    .replace(/(\d)\s*(?:-|to)\s*(\d)/g, '$1 $2');
  for (const [pattern, canon] of PHRASES) t = t.replace(pattern, ' ' + canon + ' ');
  return t;
}
const contentStems = (text) => canonicalText(text).split(/[^a-z0-9]+/).filter((w) => w && (/^\d+$/.test(w) || (w.length > 2 && !STOP.has(w)))).map(stem);

// Document frequency over the whole bank: ubiquitous words count for little.
const docs = QUESTION_BANK.map((q) => new Set(contentStems([q.questionText, ...(q.referenceConcepts || []), q.referenceAnswer].join(' '))));
const df = new Map();
for (const doc of docs) for (const s of doc) df.set(s, (df.get(s) || 0) + 1);
const idf = (s) => Math.max(0.6, Math.log(1 + docs.length / (1 + (df.get(s) || 0))));

const ramp = (value, low, high) => Math.max(0, Math.min(1, (value - low) / (high - low)));
const prefixMatch = (a, b) => {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i >= 5 && i >= n * 0.8;
};
const sharesPrefix = (s, arr) => s.length >= 5 && arr.some((o) => o.length >= 5 && prefixMatch(s, o));

function weighted(text, questionStems) {
  const seen = new Map();
  for (const s of contentStems(text)) {
    if (seen.has(s)) continue;
    seen.set(s, idf(s) * (questionStems.has(s) ? 0.4 : 1) * (/^\d+$/.test(s) ? 1.4 : 1));
  }
  return [...seen].map(([s, w]) => ({ stem: s, w }));
}
function coverage(tokens, stemSet, stemArr) {
  let total = 0, got = 0;
  const hit = [], miss = [];
  for (const { stem: s, w } of tokens) {
    total += w;
    const m = stemSet.has(s) ? 1 : sharesPrefix(s, stemArr) ? 0.7 : 0;
    got += w * m;
    (m ? hit : miss).push(s);
  }
  return { value: total ? got / total : 0, hit, miss };
}

function analyze(text) {
  const original = String(text || '').trim();
  const clauses = original.split(/(?:[.!?;]+\s+|[.!?;]+$|\n+)/).map((c) => c.trim()).filter(Boolean).map((c) => {
    const plain = normalizePlain(c), words = c.split(/\s+/).filter(Boolean).length;
    return { text: c, plain, words, stems: new Set(contentStems(c)), explained: words >= 5 && wellFormed(plain) };
  });
  const words = original.split(/\s+/).filter(Boolean);
  const allStems = new Set(clauses.flatMap((c) => [...c.stems]));
  const functionWords = words.filter((w) => FUNCTION_WORDS.has(w.toLowerCase().replace(/[^a-z']/g, ''))).length;
  const windows = [];
  for (let i = 0; i < clauses.length; i++) for (let n = 1; n <= 3 && i + n <= clauses.length; n++) {
    const slice = clauses.slice(i, i + n), plain = slice.map((c) => c.plain).join('. ');
    windows.push({ text: slice.map((c) => c.text).join('. '), plain, stems: n === 1 ? slice[0].stems : new Set(slice.flatMap((c) => [...c.stems])),
      explained: plain.split(/\s+/).length >= 5 && wellFormed(plain) });
  }
  for (const w of windows) w.arr = [...w.stems];
  return { original, clauses, windows, allStems, stemArr: [...allStems], wordCount: words.length,
    functionRatio: words.length ? functionWords / words.length : 0, explainedCount: clauses.filter((c) => c.explained).length };
}
function bestWindow(tokens, a) {
  let best = { value: 0, hit: [], miss: tokens.map((t) => t.stem), text: null };
  for (const w of a.windows) {
    const c = coverage(tokens, w.stems, w.arr);
    if (c.value > best.value) best = { ...c, text: w.text };
  }
  return best;
}

const snippet = (text, n = 90) => text.length > n ? text.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : text;
const splitSentences = (text) => String(text || '').split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/).map((s) => s.trim()).filter(Boolean);
const list = (items, max = 4) => items.slice(0, max).join(', ') + (items.length > max ? ' and ' + (items.length - max) + ' more' : '');

const rubricCache = new Map();
function buildRubric(spec) {
  const key = spec.bankId || spec.questionText;
  if (rubricCache.has(key)) return rubricCache.get(key);
  const questionStems = new Set(contentStems(spec.questionText));
  let authored = null;
  try { authored = spec.type === 'Technical' ? getRuleRubric(spec) : null; } catch { authored = null; }
  const concepts = (spec.referenceConcepts || []).map((label, i) => ({ label, tokens: weighted(label, questionStems), pattern: authored?.[i]?.pattern || null }))
    .filter((c) => c.tokens.length);
  const details = splitSentences(spec.referenceAnswer).map((text) => ({ text, tokens: weighted(text, questionStems) })).filter((s) => s.tokens.length >= 3);
  const vocab = new Set([...questionStems, ...concepts.flatMap((c) => c.tokens.map((t) => t.stem)), ...details.flatMap((d) => d.tokens.map((t) => t.stem))]);
  const rubric = { questionStems, questionTokens: weighted(spec.questionText, new Set()), concepts, details, vocab, vocabArr: [...vocab], authored: Boolean(authored) };
  rubricCache.set(key, rubric);
  return rubric;
}

function specFor(input) {
  const bank = findBankQuestion(input) || {};
  return {
    bankId: input.bankId || bank.bankId, questionText: input.questionText || bank.questionText || '', topic: input.topic || bank.topic,
    type: input.type || bank.type || 'Technical', referenceAnswer: input.referenceAnswer || bank.referenceAnswer || '',
    referenceConcepts: input.referenceConcepts?.length ? input.referenceConcepts : bank.referenceConcepts || [],
    followUpQuestions: input.followUpQuestions?.length ? input.followUpQuestions : bank.followUpQuestions || [],
    answerSource: input.referenceAnswer ? input.answerSource || 'curated' : bank.referenceAnswer ? 'curated' : 'outline',
  };
}

const ZERO = { technicalCorrectness: 0, relevance: 0, completeness: 0, clarity: 0 };
const NOTE = {
  technical: 'Scored locally by comparing your wording with the saved answer: key terms are stemmed, common synonyms are merged and distinctive terms weigh more. No AI model is used. A valid answer in very different vocabulary can be under-scored, and a fluent but wrong statement can slip through, so always compare with the saved answer.',
  behavioral: 'Scored locally on story structure (situation, goal, your actions, result, reflection), concrete detail and relevance to the question. No AI model is used and it cannot verify that your story is true or judge its quality.',
};

// Real explanations contain connecting words; a string of bare terms does not.
const isListLike = (a) => a.wordCount >= 4 && a.functionRatio < 0.1;
const proseFactor = (a) => (0.3 + 0.7 * ramp(a.functionRatio, 0.06, 0.2)) * (a.explainedCount ? 1 : 0.7);

function clarityScore(a, listLike) {
  if (!a.wordCount) return 0;
  const lengthFactor = Math.min(1, a.wordCount / 30);
  const ratio = a.explainedCount / Math.max(1, a.clauses.length);
  const avgWords = a.wordCount / Math.max(1, a.clauses.length);
  const runOn = avgWords > 45 ? 0.7 : 1;
  const sentenceFactor = listLike ? 0.25 : a.explainedCount ? Math.max(0.5, ratio) : 0.35;
  return Math.round(20 * lengthFactor * sentenceFactor * runOn);
}

function conceptResults(rubric, a, failures, listLike) {
  return rubric.concepts.map((concept, i) => {
    const best = bestWindow(concept.tokens, a);
    let earned = ramp(best.value, 0.3, 0.8), evidence = best.text, status;
    if (concept.pattern && !listLike) {
      const w = a.windows.find((win) => win.explained && concept.pattern.test(win.plain));
      if (w) { earned = 1; evidence = w.text; }
    }
    const contradiction = failures.find((f) => f.points.includes(i));
    if (contradiction) return { group: 'concept', point: concept.label, status: 'contradicted', earned: 0, maximum: 1, evidence: contradiction.evidence, note: contradiction.message, missing: best.miss };
    if (listLike) earned = Math.min(earned, 0.3);
    status = earned >= 0.75 ? 'matched' : earned >= 0.3 ? 'mentioned' : 'missing';
    return { group: 'concept', point: concept.label, status, earned: Math.round(earned * 100) / 100, maximum: 1, evidence: status === 'missing' ? null : evidence,
      note: status === 'matched' ? 'Your wording covers this idea.' : status === 'mentioned' ? 'Partly covered; explain it more fully.' : 'No clear coverage of this idea was found.' };
  });
}

function detailResults(rubric, a, listLike) {
  return rubric.details.map((detail) => {
    const whole = coverage(detail.tokens, a.allStems, a.stemArr);
    const best = bestWindow(detail.tokens, a);
    const value = Math.max(best.value, whole.value * 0.85);
    const earned = listLike ? Math.min(ramp(value, 0.2, 0.6), 0.3) : ramp(value, 0.2, 0.6);
    const status = earned >= 0.75 ? 'matched' : earned >= 0.3 ? 'mentioned' : 'missing';
    return { group: 'detail', point: snippet(detail.text, 140), status, earned: Math.round(earned * 100) / 100, maximum: 1, evidence: status === 'missing' ? null : best.text,
      note: status === 'matched' ? 'Your answer reflects this part of the saved answer.' : status === 'mentioned' ? 'Some of this detail appears.' : 'This detail from the saved answer is not reflected.', weight: detail.tokens.reduce((s, t) => s + t.w, 0) };
  });
}

// A false claim only counts when the sentence asserts it; "rather than assuming X" or
// "avoid claiming X" quotes the claim in order to reject it.
const REJECTING = /(?:rather than|instead of|not|never|avoid|myth that|wrong to|incorrect to|is not true that)\s+(?:assum\w+|claim\w+|say\w+|believ\w+|think\w+|that)?\s*$/;
function asserts(pattern, plain) {
  const match = pattern.exec(plain);
  return Boolean(match) && !REJECTING.test(plain.slice(Math.max(0, match.index - 40), match.index));
}

function gradeTechnical(spec, a, rubric) {
  const listLike = isListLike(a);
  const failures = MISCONCEPTIONS.filter((r) => (!r.topic || r.topic.test(spec.topic || '')) && r.question.test(spec.questionText))
    .flatMap((rule) => a.clauses.filter((c) => asserts(rule.pattern, c.plain)).map((c) => ({ ...rule, evidence: c.text })));
  const errors = [...new Set(failures.map((f) => f.message))];
  const concepts = conceptResults(rubric, a, failures, listLike);
  const details = detailResults(rubric, a, listLike);
  const C = concepts.length ? concepts.reduce((s, r) => s + r.earned, 0) / concepts.length : 0;
  const weightSum = details.reduce((s, r) => s + r.weight, 0);
  const R = weightSum ? details.reduce((s, r) => s + r.earned * r.weight, 0) / weightSum : C;
  const allTokens = [...new Map(rubric.details.flatMap((d) => d.tokens).map((t) => [t.stem, t])).values()];
  const overlap = allTokens.length ? coverage(allTokens, a.allStems, a.stemArr).value : 0;
  const prose = proseFactor(a);
  const lengthFactor = Math.min(1, 0.45 + a.wordCount / 22);
  const accuracy = prose * lengthFactor * (0.6 * C + 0.4 * Math.min(1, R / 0.4));
  const content = 0.15 + 0.85 * Math.min(1, accuracy / 0.35);
  const answerStems = [...a.allStems];
  const inVocab = answerStems.filter((s) => rubric.vocab.has(s) || sharesPrefix(s, rubric.vocabArr)).length;
  const precision = answerStems.length ? inVocab / answerStems.length : 0;
  const relevance01 = inVocab >= 2 ? ramp(precision, 0.15, 0.45) : 0;
  const criteriaScores = {
    technicalCorrectness: Math.max(0, Math.round(40 * accuracy) - 5 * Math.min(3, errors.length)),
    relevance: Math.round(20 * relevance01 * content),
    completeness: Math.round(20 * prose * lengthFactor * C),
    clarity: Math.round(clarityScore(a, listLike) * content),
  };
  return { criteriaScores, concepts, details, errors, listLike, matchPercent: Math.round(100 * Math.min(1, overlap)), C, R };
}

const BEHAVIOR = {
  situation: { label: 'Situation: where and when this happened', weight: 0.15, pattern: /\b(when|while|during|at my|in my|in our|our team|my team|the project|a project|last (?:year|semester|month|summer)|internship|college|university|class|course|hackathon|we were|i was (?:working|part|in)|situation|context|mentor|manager|professor|teammate|colleague|client)\b/ },
  goal: { label: 'Task or goal: what needed to be achieved', weight: 0.15, pattern: /\b(goal|task|responsib\w*|objective|needed|had to|was asked|asked (?:to|me)|assigned|deadline|requirement|aim|target|my role|challenge|problem|issue|pointed out|told me|suggested|wanted|struggl\w*|difficult|mistake|failed|disagree\w*|conflict)\b/ },
  action: { label: 'Action: what you personally did', weight: 0.30, pattern: /\bi (?:(?!am\b|was\b|think\b|believe\b|always\b|feel\b|have\b|like\b|love\b|enjoy\b|want\b)\w+ed|built|wrote|led|made|ran|chose|took|did|fixed|set|got|found|used|spoke|met|decided|began|split|broke|read|taught|worked|tried|started|began|sat|told|gave|kept|put|went|came|wrote)\b|\bmy (?:own )?(?:part|contribution|role)\b/ },
  result: { label: 'Result: what happened afterwards', weight: 0.25, pattern: /\b(result(?:ed)?|outcome|in the end|eventually|reduced|improved|increased|decreased|saved|delivered|shipped|launched|passed|resolved|succeeded|achieved|completed|finished|worked out|went well|partly|partially|after that|afterwards|later|dropped|merged|accepted|approved|released|stopped|became|faster|fewer|got better|paid off|not happened|never happened again|\d+\s?(?:%|percent|x|ms|seconds|minutes|days|hours|users|bugs))/ },
  reflection: { label: 'Reflection: what you learned or would change', weight: 0.15, pattern: /\b(learn(?:ed|t)?|lesson|realized|realised|next time|would do differently|in hindsight|takeaway|going forward|since then|now i|improve[ds]?|mistake|understood|taught me)\b/ },
};
function gradeBehavioral(spec, a, rubric) {
  const listLike = isListLike(a);
  const found = {};
  const pick = (key, from = 0) => {
    const test = (c) => c.words >= 4 && BEHAVIOR[key].pattern.test(c.plain);
    return a.clauses.slice(from).find(test) || a.clauses.find(test);
  };
  found.situation = pick('situation');
  found.goal = pick('goal');
  found.action = pick('action');
  const actionAt = Math.max(0, a.clauses.indexOf(found.action));
  found.result = pick('result', actionAt + 1);
  found.reflection = pick('reflection', Math.max(actionAt + 1, a.clauses.length - 2));
  const elements = Object.entries(BEHAVIOR).map(([key, def]) => {
    const clause = found[key], earned = clause && !listLike ? 1 : 0;
    return { key, weight: def.weight, result: { group: 'concept', point: def.label, status: earned ? 'matched' : 'missing', earned, maximum: 1, evidence: clause?.text || null,
      note: earned ? 'Found in your answer.' : 'No clear sign of this part of the story was found.' } };
  });
  const structure = elements.reduce((s, e) => s + e.weight * e.result.earned, 0);
  const specifics = (a.original.match(/\b\d+(?:\.\d+)?\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|hundred|dozen)\s+(?:minutes?|hours?|days?|weeks?|months?|users?|people|members|times|bugs)\b|\b(?:a|that|the next) (?:week|day|month|semester|year)\b|(?<=[a-z,] )[A-Z][A-Za-z+#.]{2,}/g) || []).length;
  const specificity = Math.min(1, specifics / 3);
  const concepts = conceptResults(rubric, a, [], listLike).map((r) => ({ ...r, group: 'detail' }));
  const C = concepts.length ? concepts.reduce((s, r) => s + r.earned, 0) / concepts.length : 0;
  const qCov = coverage(rubric.questionTokens, a.allStems, a.stemArr).value;
  const relevance01 = Math.max(ramp(Math.max(qCov, C), 0.15, 0.55), 0.7 * structure);
  const prose = proseFactor(a);
  const lengthFactor = Math.min(1, 0.4 + a.wordCount / 40);
  const accuracy = prose * lengthFactor * (0.65 * structure + 0.25 * specificity + 0.1 * C);
  const content = 0.15 + 0.85 * Math.min(1, accuracy / 0.35);
  const criteriaScores = {
    technicalCorrectness: Math.round(40 * accuracy),
    relevance: Math.round(20 * relevance01 * content),
    completeness: Math.round(20 * prose * lengthFactor * (0.75 * structure + 0.25 * C)),
    clarity: Math.round(clarityScore(a, listLike) * content),
  };
  return { criteriaScores, concepts: elements.map((e) => e.result), details: concepts, errors: [], listLike, matchPercent: Math.round(100 * structure), C, R: structure, behavioral: true };
}

export function gradeAnswer(input) {
  const spec = specFor(input);
  const a = analyze(input.candidateAnswer);
  const rubric = buildRubric(spec);
  const base = { evaluationKind: 'rule-based', provider: 'rules', model: null, isFallback: false, rubricVersion: RULE_VERSION,
    improvedAnswer: spec.referenceAnswer || 'Use the reference concepts as a study outline and verify the explanation against the relevant documentation.',
    answerSource: spec.answerSource, followUpQuestions: spec.followUpQuestions, recommendedTopics: [] };
  if (!rubric.concepts.length && !rubric.details.length) return null;
  if (a.allStems.size < 2) {
    return { ...base, overallScore: 0, criteriaScores: { ...ZERO }, rubricResults: [], correctConcepts: [], mentionedConcepts: [], coveragePercent: 0,
      missingConcepts: rubric.concepts.map((c) => c.label), mistakes: [], recommendedTopics: [spec.topic].filter(Boolean),
      explanation: spec.type === 'Technical' ? NOTE.technical : NOTE.behavioral,
      feedback: 'This answer is too short to compare with the saved answer. Explain the idea in a few full sentences, then compare it with the worked answer below.' };
  }
  const r = spec.type === 'Technical' ? gradeTechnical(spec, a, rubric) : gradeBehavioral(spec, a, rubric);
  const scores = Object.fromEntries(Object.entries(r.criteriaScores).map(([k, v]) => [k, Math.max(0, Math.min({ technicalCorrectness: 40, relevance: 20, completeness: 20, clarity: 20 }[k], v))]));
  const overallScore = Object.values(scores).reduce((s, n) => s + n, 0);
  const results = [...r.concepts, ...r.details].map(({ weight, missing, ...rest }) => rest);
  const matched = r.concepts.filter((x) => x.status === 'matched'), partial = r.concepts.filter((x) => x.status === 'mentioned'), absent = r.concepts.filter((x) => x.status === 'missing' || x.status === 'contradicted');
  const sentences = [];
  if (r.behavioral) {
    sentences.push(matched.length + ' of ' + r.concepts.length + ' story elements are present' + (absent.length ? '; missing: ' + list(absent.map((x) => x.point.split(':')[0].toLowerCase())) + '.' : '.'));
  } else {
    sentences.push(matched.length + ' of ' + r.concepts.length + ' key concepts are covered' + (matched.length ? ' (' + list(matched.map((x) => x.point), 3) + ')' : '') + '.');
    if (partial.length) sentences.push('Needs fuller explanation: ' + list(partial.map((x) => x.point)) + '.');
    if (absent.length) sentences.push('Not found: ' + list(absent.map((x) => x.point)) + '.');
    sentences.push('Your answer reflects about ' + r.matchPercent + '% of the key terms in the saved answer.');
  }
  if (r.listLike) sentences.push('It reads as a list of terms; explain how and why each one applies, because a list alone earns little credit.');
  if (r.errors.length) sentences.push('Check these statements: ' + r.errors.join(' '));
  return { ...base, overallScore, criteriaScores: scores, rubricResults: results,
    correctConcepts: matched.map((x) => x.point), mentionedConcepts: partial.map((x) => x.point), missingConcepts: absent.map((x) => x.point),
    mistakes: r.errors, coveragePercent: r.matchPercent, explanation: r.behavioral ? NOTE.behavioral : NOTE.technical, feedback: sentences.join(' '),
    recommendedTopics: overallScore < 70 ? [spec.topic].filter(Boolean) : [] };
}
