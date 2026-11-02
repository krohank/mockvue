/**
 * End-to-end API test against a real MongoDB.
 *
 *   npm run test:e2e                         # starts an in-memory MongoDB (mongodb-memory-server)
 *   MONGODB_URI=mongodb://... npm run test:e2e   # or use your own database
 *
 * Boots the Express app on a random port and walks the full candidate flow,
 * including the security fixes (sanitised questions, report gating, server
 * time limits, warning limits, auth checks).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

let server;
let base;
let memoryServer;

before(async () => {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }
  await mongoose.connect(uri, { dbName: `mockvue_e2e_${Date.now()}` });
  const { default: app } = await import('../../src/app.js');
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  await new Promise((resolve) => server?.close(resolve));
  await memoryServer?.stop();
});

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

const register = async (suffix = Math.random().toString(36).slice(2, 8)) => {
  const res = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Test Candidate', email: `cand_${suffix}@college.edu`, password: 'correct-horse-9', targetRole: 'Backend Developer' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.token;
};

const generate = (token, overrides = {}) =>
  call('/interviews/generate', {
    method: 'POST',
    token,
    body: {
      targetRole: 'Backend Developer',
      topics: ['Database Management Systems', 'Operating Systems'],
      difficulty: 'Medium',
      interviewType: 'Technical',
      questionCount: 3,
      durationMinutes: 15,
      ...overrides,
    },
  });

test('auth: register, login, validation, and token checks', async () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const token = await register(suffix);

  const short = await call('/auth/register', { method: 'POST', body: { name: 'x', email: 'short@pw.dev', password: '123' } });
  assert.equal(short.status, 400);

  const dup = await call('/auth/register', { method: 'POST', body: { name: 'x', email: `cand_${suffix}@college.edu`, password: 'another-pass-1' } });
  assert.equal(dup.status, 409);

  const bad = await call('/auth/login', { method: 'POST', body: { email: `cand_${suffix}@college.edu`, password: 'wrong-password' } });
  assert.equal(bad.status, 401);

  const good = await call('/auth/login', { method: 'POST', body: { email: `CAND_${suffix}@college.edu`, password: 'correct-horse-9' } });
  assert.equal(good.status, 200);
  assert.equal(good.body.user.passwordHash, undefined);

  const me = await call('/auth/me', { token });
  assert.equal(me.status, 200);

  // Expired tokens are rejected (no silent re-acceptance).
  const { env } = await import('../../src/config/env.js');
  const expired = jwt.sign({ id: me.body.user._id, exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET);
  assert.equal((await call('/auth/me', { token: expired })).status, 401);

  // Tokens for unknown users never create accounts.
  const ghost = jwt.sign({ id: new mongoose.Types.ObjectId().toString(), email: 'ghost@x.dev' }, env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal((await call('/auth/me', { token: ghost })).status, 401);

  // Wrong current password is a 400 (not a 401 that would log the user out).
  const pw = await call('/users/password', { method: 'PUT', token, body: { currentPassword: 'nope', newPassword: 'new-password-1' } });
  assert.equal(pw.status, 400);
});

test('interview flow: generate → start → answer → report', async () => {
  const token = await register();

  const invalid = await generate(token, { difficulty: 'Impossible' });
  assert.equal(invalid.status, 400);

  const gen = await generate(token);
  assert.equal(gen.status, 201, JSON.stringify(gen.body));
  const id = gen.body.interviewId;

  const fetched = await call(`/interviews/${id}`, { token });
  const questions = fetched.body.interview.questions;
  assert.equal(questions.length, 3);
  for (const q of questions) {
    assert.equal(q.referenceConcepts, undefined, 'reference concepts must stay hidden');
    assert.equal(q.evaluationCriteria, undefined, 'criteria must stay hidden');
  }

  // Report is gated until the interview ends.
  assert.equal((await call(`/interviews/${id}/report`, { token })).status, 409);
  // Answers before start are rejected.
  assert.equal(
    (await call(`/interviews/${id}/answer`, { method: 'POST', token, body: { questionId: questions[0]._id, responseText: 'early' } })).status,
    409
  );

  const start = await call(`/interviews/${id}/start`, { method: 'POST', token });
  assert.equal(start.body.status, 'in_progress');
  assert.ok(start.body.deadline);

  const answer = await call(`/interviews/${id}/answer`, {
    method: 'POST',
    token,
    body: {
      questionId: questions[0]._id,
      responseText:
        'Answer with mechanisms, trade-offs, and an example. Because indexes use B+ trees, lookups are O(log n), while writes pay extra cost to keep the tree balanced.',
      responseType: 'voice',
      timeSpentSeconds: 90,
    },
  });
  assert.equal(answer.status, 201, JSON.stringify(answer.body));
  const ev = answer.body.evaluation;
  assert.ok(ev.overallScore >= 0 && ev.overallScore <= 100);
  assert.equal(ev.overallScore, Object.values(ev.criteriaScores).reduce((a, b) => a + b, 0));
  assert.equal(ev.responseType, 'voice');

  const dup = await call(`/interviews/${id}/answer`, { method: 'POST', token, body: { questionId: questions[0]._id, responseText: 'again' } });
  assert.equal(dup.status, 409);

  const done = await call(`/interviews/${id}/complete`, {
    method: 'POST',
    token,
    body: { proctoringSummary: { engine: 'mediapipe', attentionPct: 140, facePresentPct: 99 } },
  });
  assert.equal(done.body.status, 'completed');
  assert.equal(done.body.endReason, 'submitted_early');
  // One answered of three: unanswered questions count as zero.
  assert.equal(done.body.overallScore, Math.round(ev.overallScore / 3));

  const report = await call(`/interviews/${id}/report`, { token });
  assert.equal(report.status, 200);
  assert.ok(report.body.report[0].question.referenceConcepts.length > 0, 'keys revealed after completion');
  assert.equal(report.body.interview.proctoringSummary.attentionPct, 100);

  const history = await call('/interviews/history', { token });
  assert.equal(history.body.interviews[0].answeredCount, 1);
  assert.equal(history.body.interviews[0].questionCount, 3);

  const overview = await call('/analytics/overview', { token });
  assert.equal(overview.body.overview.completedCount, 1);
  const perf = await call('/analytics/performance', { token });
  assert.equal(perf.body.analytics.scoreTrend.length, 1);
});

test('proctoring: warnings count, info events do not, fifth warning terminates', async () => {
  const token = await register();
  const id = (await generate(token)).body.interviewId;
  await call(`/interviews/${id}/start`, { method: 'POST', token });

  const unknown = await call(`/interviews/${id}/monitoring`, { method: 'POST', token, body: { eventType: 'made_up' } });
  assert.equal(unknown.status, 400);

  const info = await call(`/interviews/${id}/monitoring`, { method: 'POST', token, body: { eventType: 'proctoring_started' } });
  assert.equal(info.body.countedAsWarning, false);
  assert.equal(info.body.totalWarnings, 0);

  let last;
  for (let i = 1; i <= 5; i += 1) {
    last = await call(`/interviews/${id}/monitoring`, {
      method: 'POST',
      token,
      body: { eventType: 'eye_gaze_deviated', description: `look away ${i}`, metadata: { yaw: 40.123456, nested: { no: 1 } } },
    });
    assert.equal(last.body.totalWarnings, i);
  }
  assert.equal(last.body.isTerminated, true);
  assert.equal(last.body.status, 'terminated');

  const after = await call(`/interviews/${id}/monitoring`, { method: 'POST', token, body: { eventType: 'phone_detected' } });
  assert.equal(after.body.accepted, false);

  const events = await call(`/interviews/${id}/monitoring`, { token });
  assert.equal(events.body.bySeverity.warning, 5);
  assert.deepEqual(events.body.events[1].metadata, { yaw: 40.123 });
});

test('proctoring: leaving the tab is critical', async () => {
  const token = await register();
  const id = (await generate(token)).body.interviewId;
  await call(`/interviews/${id}/start`, { method: 'POST', token });
  const res = await call(`/interviews/${id}/monitoring`, { method: 'POST', token, body: { eventType: 'tab_switched' } });
  assert.equal(res.body.severity, 'critical');
  assert.equal(res.body.isTerminated, true);
  const report = await call(`/interviews/${id}/report`, { token });
  assert.equal(report.body.interview.endReason, 'proctoring');
});

test('time limit is enforced by the server', async () => {
  const token = await register();
  const id = (await generate(token)).body.interviewId;
  await call(`/interviews/${id}/start`, { method: 'POST', token });
  const { default: Interview } = await import('../../src/models/Interview.js');
  await Interview.updateOne({ _id: id }, { $set: { startedAt: new Date(Date.now() - 20 * 60_000) } });

  const q = (await call(`/interviews/${id}`, { token })).body.interview;
  assert.equal(q.status, 'completed', 'overdue interview is closed lazily on read');
  assert.equal(q.endReason, 'time_expired');
});

test('ownership: other users cannot read or delete an interview', async () => {
  const owner = await register();
  const intruder = await register();
  const id = (await generate(owner)).body.interviewId;
  assert.equal((await call(`/interviews/${id}`, { token: intruder })).status, 403);
  assert.equal((await call(`/interviews/${id}`, { method: 'DELETE', token: intruder })).status, 403);
  assert.equal((await call(`/interviews/${id}`, { method: 'DELETE', token: owner })).status, 200);
  assert.equal((await call(`/interviews/${id}`, { token: owner })).status, 404);
});
