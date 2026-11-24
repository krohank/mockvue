import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { FallbackProvider } from '../src/services/ai/FallbackProvider.js';
import { normalizeEvaluation } from '../src/services/ai/evaluation.js';
let wakeEvaluationWorker, startEvaluationWorker, stopEvaluationWorker;

let memory, server, root, token, otherToken, userId;
const secret = 'regression-secret-for-isolated-tests-only';
const config = { targetRole: 'Software Development Engineer', topics: ['Data Structures & Algorithms'], difficulty: 'Medium', questionCount: 2, durationMinutes: 20 };
const call = async (url, body, auth = token, method = body === undefined ? 'GET' : 'POST') => {
  const res = await fetch(root + url, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { ...(await res.json()), status: res.status };
};
const generate = async (extra = {}) => {
  const res = await call('/interviews/generate', { ...config, ...extra });
  assert.equal(res.status, 201, res.message);
  return res.interviewId;
};
const load = (id) => call('/interviews/' + id);
before(async () => {
  process.env.NODE_ENV = 'test'; process.env.AI_PROVIDER = 'fallback'; process.env.JWT_SECRET = secret;
  memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri('mockvue_regression'));
  const { default: app } = await import('../src/app.js');
  ({ wakeEvaluationWorker, startEvaluationWorker, stopEvaluationWorker } = await import('../src/services/evaluationQueue.js'));
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  startEvaluationWorker();
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  root = 'http://127.0.0.1:' + server.address().port + '/api';
  const a = await call('/auth/register', { name: 'Regression Candidate', email: 'audit@example.com', password: 'Testing123!' }, null);
  assert.equal(a.status, 201); token = a.token; userId = a.user._id;
  const b = await call('/auth/register', { name: 'Other Candidate', email: 'other@example.com', password: 'Testing123!' }, null);
  otherToken = b.token;
});
afterEach(async () => { await wakeEvaluationWorker(); });
after(async () => {
  await stopEvaluationWorker();
  const { stopSpeech } = await import('../src/services/speechService.js'); stopSpeech();
  if (server) { server.close(); await once(server, 'close'); }
  await mongoose.disconnect(); await memory?.stop();
});
test('registration validates types and email without exposing passwords', async () => {
  const malformed = await call('/auth/register', { name: {}, email: [], password: 5 }, null);
  assert.equal(malformed.status, 400);
  const badEmail = await call('/auth/register', { name: 'Valid Name', email: 'not-an-email', password: 'abcdef' }, null);
  assert.equal(badEmail.status, 400);
  const me = await call('/auth/me'); assert.equal(me.user.passwordHash, undefined);
});
test('wrong password does not create or restore an account', async () => {
  const count = await mongoose.models.User.countDocuments();
  const result = await call('/auth/login', { email: 'audit@example.com', password: 'wrong-password' }, null);
  assert.equal(result.status, 401); assert.equal(await mongoose.models.User.countDocuments(), count);
});
test('expired JWTs are rejected', async () => {
  const expired = jwt.sign({ id: userId }, secret, { expiresIn: -1 });
  assert.equal((await call('/auth/me', undefined, expired)).status, 401);
});
test('signed tokens for missing accounts never recreate them', async () => {
  const id = new mongoose.Types.ObjectId();
  const forged = jwt.sign({ id: String(id), email: 'missing@example.com' }, secret);
  assert.equal((await call('/auth/me', undefined, forged)).status, 401);
  assert.equal(await mongoose.models.User.findById(id), null);
});
test('question generation rejects invalid parameters and unrelated topics', async () => {
  assert.equal((await call('/interviews/generate', { ...config, difficulty: 'Impossible' })).status, 400);
  assert.equal((await call('/interviews/generate', { ...config, topics: ['Unsupported Subject'] })).status, 400);
  assert.equal((await call('/interviews/generate', { ...config, mode: 'anything' })).status, 400);
});
test('active questions and reports keep reference answers private', async () => {
  const id = await generate(); const result = await load(id);
  for (const q of result.interview.questions) for (const field of ['referenceConcepts', 'referenceAnswer', 'evaluationCriteria', 'bankId', 'followUpQuestions']) assert.equal(q[field], undefined);
  assert.equal((await call('/interviews/' + id + '/report')).status, 403);
});
test('answers cannot be submitted before starting', async () => {
  const id = await generate(), result = await load(id);
  assert.equal((await call('/interviews/' + id + '/answer', { questionId: result.interview.questions[0]._id, responseText: 'A valid answer with enough explanation.' })).status, 400);
});
test('starting twice preserves the server-owned deadline', async () => {
  const id = await generate();
  const first = await call('/interviews/' + id + '/start', {});
  const retry = await call('/interviews/' + id + '/start', {});
  assert.equal(first.startedAt, retry.startedAt); assert.equal(first.endsAt, retry.endsAt);
  assert.equal(Date.parse(first.endsAt) - Date.parse(first.startedAt), config.durationMinutes * 60000);
});
test('out-of-order answers are rejected', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  const result = await load(id);
  assert.equal((await call('/interviews/' + id + '/answer', { questionId: result.interview.questions[1]._id, responseText: 'A valid answer with enough explanation.' })).status, 400);
});
test('concurrent voice submissions are idempotent and restore the correct pointer', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  const result = await load(id), questionId = result.interview.questions[0]._id;
  const body = { questionId, responseText: 'A hash map uses buckets with collision resolution and constant time lookup.', responseType: 'voice' };
  const results = await Promise.all([call('/interviews/' + id + '/answer', body), call('/interviews/' + id + '/answer', body)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  assert.equal(await mongoose.models.Answer.countDocuments({ interviewId: id, questionId }), 1);
  const restored = (await load(id)).interview;
  assert.equal(restored.currentQuestionIndex, 1); assert.equal(restored.answers[0].responseType, 'voice');
});
test('unsupported response formats return a clear validation error', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  const result = await load(id);
  assert.equal((await call('/interviews/' + id + '/answer', { questionId: result.interview.questions[0]._id, responseText: 'An answer.', responseType: 'audio_transcript' })).status, 400);
});
test('skipping is explicit and scores zero', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  const result = await load(id);
  const skipped = await call('/interviews/' + id + '/answer', { questionId: result.interview.questions[0]._id, skipped: true });
  assert.equal(skipped.status, 201); assert.equal(skipped.evaluation.skipped, true); assert.equal(skipped.evaluation.overallScore, 0);
});
test('early completion with a guided answer remains ungraded', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  const result = await load(id);
  const answer = await call('/interviews/' + id + '/answer', { questionId: result.interview.questions[0]._id, responseText: 'A hash map stores a key value pair and uses buckets for collision resolution with a linked list.' });
  const completed = await call('/interviews/' + id + '/complete', {});
  await wakeEvaluationWorker();
  const final = await call('/interviews/' + id + '/report');
  assert.equal(final.interview.overallScore, null); assert.equal(final.interview.scoreStatus, 'ungraded');
  assert.equal((await call('/interviews/' + id + '/report')).status, 200);
});
test('completed interviews reject new answers and do not restart', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  await call('/interviews/' + id + '/complete', {});
  const result = await load(id);
  assert.equal((await call('/interviews/' + id + '/answer', { questionId: result.interview.questions[0]._id, responseText: 'Late answer that must not be scored.' })).status, 400);
  assert.equal((await call('/interviews/' + id + '/start', {})).status, 400);
});
test('practice mode does not terminate on a tab switch', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  const event = await call('/interviews/' + id + '/monitoring', { eventType: 'tab_switched', description: 'Practice tab switch' });
  assert.equal(event.status, 201); assert.equal(event.isTerminated, false);
  assert.equal((await load(id)).interview.status, 'in_progress');
});
test('assessment full-screen exit finalizes and prevents later answers', async () => {
  const id = await generate({ mode: 'assessment' }); await call('/interviews/' + id + '/start', {});
  const event = await call('/interviews/' + id + '/monitoring', { eventType: 'fullscreen_exit', description: 'Assessment exit' });
  assert.equal(event.isTerminated, true);
  const result = await load(id);
  assert.equal(result.interview.overallScore, 0);
  assert.equal((await call('/interviews/' + id + '/answer', { questionId: result.interview.questions[0]._id, responseText: 'No late answers should be accepted.' })).status, 400);
});
test('assessment deadlines are enforced by the server', async () => {
  const id = await generate({ mode: 'assessment', durationMinutes: 5 }); await call('/interviews/' + id + '/start', {});
  await mongoose.models.Interview.updateOne({ _id: id }, { startedAt: new Date(Date.now() - 6 * 60000) });
  const result = await load(id);
  assert.equal((await call('/interviews/' + id + '/answer', { questionId: result.interview.questions[0]._id, responseText: 'An answer after the server time limit.' })).status, 400);
});
test('interview ownership is enforced for reads and reports', async () => {
  const id = await generate();
  assert.equal((await call('/interviews/' + id, undefined, otherToken)).status, 403);
  assert.equal((await call('/interviews/' + id + '/report', undefined, otherToken)).status, 403);
});
test('speech upload requires authentication and audio data', async () => {
  assert.equal((await call('/speech/transcribe', {}, null)).status, 401);
  assert.equal((await call('/speech/transcribe', {})).status, 400);
});
test('bank questions stay within selected topics and never repeat', async () => {
  const provider = new FallbackProvider();
  for (const topic of ['React & Frontend Architecture', 'Python Programming', 'Java & Spring Boot', 'Node.js & Backend Architecture', 'SQL & Data Modeling', 'JavaScript & TypeScript']) {
    const result = await provider.generateQuestions({ topics: [topic], questionCount: 8, difficulty: 'Medium' });
    assert.ok(result.questions.length >= 3);
    assert.ok(result.questions.every((q) => q.topic === topic));
    assert.equal(new Set(result.questions.map((q) => q.questionText)).size, result.questions.length);
    assert.ok(result.message);
  }
});
test('irrelevant answers receive no invented praise or concepts', async () => {
  const result = await new FallbackProvider().evaluateAnswer({ referenceConcepts: ['hash collision', 'balanced tree'], candidateAnswer: 'I enjoy a sunny afternoon with a cup of tea.' });
  assert.equal(result.overallScore, null); assert.equal(result.evaluationKind, 'concept-check'); assert.deepEqual(result.correctConcepts, []);
});
test('AI score normalization clamps criteria and uses their actual sum', () => {
  const result = normalizeEvaluation({ overallScore: 999, criteriaScores: { technicalCorrectness: 80, relevance: -2, completeness: 10.5, clarity: 10 } });
  assert.equal(result.overallScore, 61); assert.equal(result.criteriaScores.technicalCorrectness, 40);
  assert.throws(() => normalizeEvaluation({ criteriaScores: { technicalCorrectness: 'invalid' } }));
});
test('health declares key-free operation and the effective provider', async () => {
  const result = await call('/health');
  assert.equal(result.ai.apiKeyRequired, false); assert.equal(result.ai.localOnly, true);
  assert.equal(result.ai.effectiveProvider, 'fallback');
});

test('question source and actual feedback provider are persisted independently', async () => {
  const { aiService } = await import('../src/services/ai/AIProviderFactory.js');
  const id = await generate({ questionCount: 1 });
  await call('/interviews/' + id + '/start', {});
  const session = (await load(id)).interview;
  assert.equal(session.questionProvider, 'fallback');
  const original = aiService.evaluateAnswer;
  try {
    aiService.evaluateAnswer = async () => ({ criteriaScores: { technicalCorrectness: 20, relevance: 10, completeness: 10, clarity: 10 }, provider: 'local', model: 'regression-local-model', isFallback: false });
    const saved = await call('/interviews/' + id + '/answer', { questionId: session.questions[0]._id, responseText: 'A prepared answer for the provider metadata regression.' });
    assert.equal(saved.status, 201);
    await wakeEvaluationWorker();
    const report = await call('/interviews/' + id + '/report');
    assert.equal(report.interview.questionProvider, 'fallback'); assert.equal(report.report[0].answer.evaluationProvider, 'local');
    assert.equal(report.report[0].answer.evaluationModel, 'regression-local-model'); assert.equal(report.report[0].answer.isFallbackEvaluation, false);
    assert.equal(report.interview.overallScore, 50);
  } finally { aiService.evaluateAnswer = original; }
});

test('a complete guided interview preserves answers, history, and actual practice time', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  await mongoose.models.Interview.updateOne({ _id: id }, { startedAt: new Date(Date.now() - 125000) });
  const interview = (await load(id)).interview;
  const scores = [];
  for (const question of interview.questions) {
    const result = await call('/interviews/' + id + '/answer', { questionId: question._id, responseText: 'A hash map uses collision chaining and linked list buckets. A balanced tree supports logarithmic search. I would analyze time complexity and memory overhead, then use an example to explain the trade-offs.' });
    assert.equal(result.status, 201); scores.push(result.evaluation.overallScore);
    assert.equal(result.evaluation.overallScore, null);
  }
  await wakeEvaluationWorker();
  const report = await call('/interviews/' + id + '/report');
  assert.equal(report.status, 200); assert.equal(report.interview.status, 'completed');
  assert.equal(report.interview.overallScore, null); assert.equal(report.interview.scoreStatus, 'ungraded');
  assert.ok(report.report.every((r) => r.answer.evaluationStatus === 'completed' && r.answer.improvedAnswer.length > 80));
  assert.equal(report.report.filter((r) => r.answer).length, interview.questions.length);
  const history = await call('/interviews/history'); assert.ok(history.interviews.some((i) => i._id === id && i.status === 'completed'));
  const overview = await call('/analytics/overview'); assert.ok(overview.overview.totalMinutesPracticed >= 2 && overview.overview.totalMinutesPracticed < 20);
});

test('a server-checkpointed draft is recovered and reviewed after browser suspension', async () => {
  const id = await generate({ durationMinutes: 5 }); await call('/interviews/' + id + '/start', {});
  const questionId = (await load(id)).interview.questions[0]._id;
  const text = 'A hash map uses collision chaining and linked list buckets with constant time lookup.';
  const saved = await call('/interviews/' + id + '/draft', { questionId, responseText: text, responseType: 'voice' }, token, 'PUT');
  assert.equal(saved.status, 200); assert.equal((await load(id)).interview.draft.responseText, text);
  await mongoose.models.Interview.updateOne({ _id: id }, { startedAt: new Date(Date.now() - 10 * 60000), 'draft.savedAt': new Date(Date.now() - 6 * 60000) });
  assert.equal((await call('/interviews/' + id + '/draft', { questionId, responseText: 'A late edit' }, token, 'PUT')).status, 400);
  const done = await call('/interviews/' + id + '/complete', {});
  assert.equal(done.status, 200);
  const report = await call('/interviews/' + id + '/report');
  assert.equal(report.report[0].answer.responseText, text); assert.equal(report.report[0].answer.responseType, 'voice');
  await wakeEvaluationWorker();
  assert.equal((await call('/interviews/' + id + '/report')).interview.overallScore, null);
});
test('draft checkpoints are private and cannot change a closed interview', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  const questionId = (await load(id)).interview.questions[0]._id;
  assert.equal((await call('/interviews/' + id + '/draft', { questionId, responseText: 'Private draft' }, otherToken, 'PUT')).status, 403);
  await call('/interviews/' + id + '/complete', {});
  assert.equal((await call('/interviews/' + id + '/draft', { questionId, responseText: 'Late draft' }, token, 'PUT')).status, 400);
});

test('guided practice is excluded from score analytics', async () => {
  const account = await call('/auth/register', { name: 'Guided Test', email: 'guided@example.com', password: 'Testing123!' }, null);
  const auth = account.token;
  const created = await call('/interviews/generate', { ...config, questionCount: 1 }, auth);
  const id = created.interviewId;
  await call('/interviews/' + id + '/start', {}, auth);
  const session = await call('/interviews/' + id, undefined, auth);
  await call('/interviews/' + id + '/answer', { questionId: session.interview.questions[0]._id, responseText: 'Some reference words do not establish correctness.' }, auth);
  await wakeEvaluationWorker();
  const result = await call('/analytics/performance', undefined, auth);
  assert.deepEqual(result.analytics.topicPerformance, []); assert.deepEqual(result.analytics.scoreTrend, []);
  assert.equal(result.analytics.guidedAnswerCount, 1); assert.equal(result.analytics.totalAnswersAnalyzed, 0);
  const overview = await call('/analytics/overview', undefined, auth);
  assert.equal(overview.overview.averageScore, null); assert.equal(overview.overview.gradedCount, 0);
});

test('slow grading never blocks saving the next answer or completing the interview', async () => {
  const { aiService } = await import('../src/services/ai/AIProviderFactory.js');
  const original = aiService.evaluateAnswer;
  let release, entered;
  const gate = new Promise((resolve) => { release = resolve; });
  const active = new Promise((resolve) => { entered = resolve; });
  try {
    aiService.evaluateAnswer = async () => { entered(); await gate; return { criteriaScores: { technicalCorrectness: 30, relevance: 15, completeness: 15, clarity: 15 }, provider: 'local', model: 'slow-test', evaluationKind: 'rubric', isFallback: false }; };
    const id = await generate(); await call('/interviews/' + id + '/start', {});
    const session = (await load(id)).interview;
    const first = await call('/interviews/' + id + '/answer', { questionId: session.questions[0]._id, responseText: 'Persist this first answer before the evaluator completes.' });
    assert.equal(first.status, 201); assert.equal(first.evaluation.evaluationStatus, 'pending');
    await active;
    const second = await call('/interviews/' + id + '/answer', { questionId: session.questions[1]._id, responseText: 'The next answer must also be accepted while feedback is blocked.' });
    assert.equal(second.status, 201); assert.equal(second.isComplete, true);
    const pending = await call('/interviews/' + id + '/report');
    assert.equal(pending.interview.scoreStatus, 'pending'); assert.equal(pending.interview.overallScore, null);
    assert.equal(pending.report.filter((r) => r.answer).length, 2);
    release(); await wakeEvaluationWorker();
    const finished = await call('/interviews/' + id + '/report');
    assert.equal(finished.interview.overallScore, 75); assert.equal(finished.interview.scoreStatus, 'graded');
    assert.ok(finished.report.every((r) => r.answer.evaluationStatus === 'completed'));
  } finally { release(); await wakeEvaluationWorker(); aiService.evaluateAnswer = original; }
});

test('an interrupted grading lease is recovered without losing or duplicating the answer', async () => {
  const id = await generate({ questionCount: 1 }); await call('/interviews/' + id + '/start', {});
  const question = (await load(id)).interview.questions[0];
  await mongoose.models.Answer.create({ interviewId: id, userId, questionId: question._id, responseText: 'Persisted before the previous worker stopped.', evaluationStatus: 'processing', gradingStartedAt: new Date(Date.now() - 181000) });
  await call('/interviews/' + id + '/complete', {});
  await wakeEvaluationWorker();
  const report = await call('/interviews/' + id + '/report');
  assert.equal(report.report[0].answer.evaluationStatus, 'completed');
  assert.match(report.report[0].answer.responseText, /Persisted/);
  assert.equal(await mongoose.models.Answer.countDocuments({ interviewId: id }), 1);
});

test('a saved answer restores progress even if the process stopped before updating the interview pointer', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  const session = (await load(id)).interview;
  await mongoose.models.Answer.create({ interviewId: id, userId, questionId: session.questions[0]._id, responseText: '[Skipped]', skipped: true, overallScore: 0 });
  const result = await call('/interviews/' + id + '/answer', { questionId: session.questions[1]._id, responseText: 'Continue from the persisted answer despite the stale pointer.' });
  assert.equal(result.status, 201); assert.equal(result.isComplete, true);
});

test('invalid question identifiers return a validation error', async () => {
  const id = await generate(); await call('/interviews/' + id + '/start', {});
  assert.equal((await call('/interviews/' + id + '/answer', { questionId: 'broken-id', responseText: 'An answer.' })).status, 400);
});


test('reading a fully answered session recovers completion after an interrupted pointer update', async () => {
  const id = await generate({ questionCount: 1 }); await call('/interviews/' + id + '/start', {});
  const session = (await load(id)).interview;
  await mongoose.models.Answer.create({ interviewId: id, userId, questionId: session.questions[0]._id, responseText: '[Skipped]', skipped: true, overallScore: 0 });
  const restored = await load(id);
  assert.equal(restored.interview.status, 'completed'); assert.equal(restored.interview.currentQuestionIndex, 1);
  assert.equal((await call('/interviews/' + id + '/report')).status, 200);
});
