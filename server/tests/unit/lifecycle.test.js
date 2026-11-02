import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOverallScore,
  getDeadline,
  isPastDeadline,
  sanitizeProctoringSummary,
  isFinal,
} from '../../src/services/interviewLifecycle.js';
import { computeStreak, sanitizeMetadata, readinessFor } from '../../src/controllers/analytics.controller.js';
import { MONITORING_EVENT_SEVERITY, MONITORING_EVENT_TYPES } from '../../src/config/constants.js';
import MonitoringEvent from '../../src/models/MonitoringEvent.js';
import { generateToken, verifyToken } from '../../src/utils/jwt.js';

describe('interview lifecycle', () => {
  test('overall score averages over all questions, unanswered count as zero', () => {
    assert.equal(computeOverallScore([80, 90], 2), 85);
    assert.equal(computeOverallScore([80, 90], 4), 43);
    assert.equal(computeOverallScore([], 5), 0);
    assert.equal(computeOverallScore([], 0), 0);
  });

  test('deadline and grace window', () => {
    const startedAt = new Date('2026-01-01T10:00:00Z');
    const interview = { startedAt, durationMinutes: 20 };
    assert.equal(getDeadline(interview).toISOString(), '2026-01-01T10:20:00.000Z');
    const t = (min, sec = 0) => startedAt.getTime() + min * 60_000 + sec * 1000;
    assert.equal(isPastDeadline(interview, t(20, 30)), false, 'inside 60s grace');
    assert.equal(isPastDeadline(interview, t(21, 1)), true);
    assert.equal(isPastDeadline({ startedAt: null, durationMinutes: 20 }, t(99)), false);
    assert.equal(isPastDeadline(interview, t(19, 55), -10), true, 'negative grace allows early expiry check');
  });

  test('final statuses', () => {
    assert.equal(isFinal({ status: 'completed' }), true);
    assert.equal(isFinal({ status: 'terminated' }), true);
    assert.equal(isFinal({ status: 'in_progress' }), false);
  });

  test('proctoring summary is clamped and typed', () => {
    const s = sanitizeProctoringSummary({
      engine: 'hacked',
      attentionPct: 140,
      facePresentPct: '97.26',
      multiplePeoplePct: -3,
      framesAnalyzed: -10,
      phoneDetections: 2.6,
      calibrated: 'yes',
    });
    assert.equal(s.engine, 'none');
    assert.equal(s.attentionPct, 100);
    assert.equal(s.facePresentPct, 97.3);
    assert.equal(s.multiplePeoplePct, 0);
    assert.equal(s.framesAnalyzed, 0);
    assert.equal(s.phoneDetections, 3);
    assert.equal(s.calibrated, true);
    assert.equal(sanitizeProctoringSummary('nope'), null);
  });
});

describe('analytics helpers', () => {
  test('streak counts consecutive days ending today or yesterday', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    const d = (s) => new Date(`2026-03-${s}T09:00:00Z`);
    assert.equal(computeStreak([d('10'), d('09'), d('08'), d('05')], now), 3);
    assert.equal(computeStreak([d('09'), d('08')], now), 2);
    assert.equal(computeStreak([d('07')], now), 0);
    assert.equal(computeStreak([], now), 0);
  });

  test('readiness thresholds', () => {
    assert.equal(readinessFor(0, 0), 'Not Started');
    assert.equal(readinessFor(3, 80), 'Placement Ready');
    assert.equal(readinessFor(3, 60), 'Progressing');
    assert.equal(readinessFor(3, 30), 'Needs Practice');
  });

  test('monitoring metadata keeps only small primitives', () => {
    const m = sanitizeMetadata({ yaw: 12.34567, label: 'cell phone'.repeat(20), nested: { a: 1 }, 'bad key!': true, fn: () => 1 });
    assert.deepEqual(Object.keys(m).sort(), ['badkey', 'label', 'yaw']);
    assert.equal(m.yaw, 12.346);
    assert.equal(m.label.length, 80);
    assert.equal(sanitizeMetadata([1, 2]), undefined);
    assert.equal(sanitizeMetadata({}), undefined);
  });
});

describe('monitoring event catalogue', () => {
  test('every event type has a severity and is allowed by the model', () => {
    const allowed = MonitoringEvent.schema.path('eventType').enumValues;
    for (const type of MONITORING_EVENT_TYPES) {
      assert.ok(['info', 'warning', 'critical'].includes(MONITORING_EVENT_SEVERITY[type]), type);
      assert.ok(allowed.includes(type), type);
    }
    assert.equal(MONITORING_EVENT_SEVERITY.tab_switched, 'critical');
    assert.equal(MONITORING_EVENT_SEVERITY.phone_detected, 'warning');
    assert.equal(MONITORING_EVENT_SEVERITY.camera_unavailable, 'info');
  });
});

describe('jwt', () => {
  test('tokens carry only the user id', () => {
    const token = generateToken({ _id: '507f1f77bcf86cd799439011', email: 'a@b.co', name: 'A' });
    const decoded = verifyToken(token);
    assert.equal(decoded.id, '507f1f77bcf86cd799439011');
    assert.equal(decoded.email, undefined);
    assert.ok(decoded.exp > decoded.iat);
  });
});
