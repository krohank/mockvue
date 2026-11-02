// Run with: npm test (node --test). Pure modules only — no browser APIs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  poseFromMatrix,
  gazeFromBlendshapes,
  boundingBox,
  framingOf,
  classifyAttention,
  baselineFromSamples,
  NEUTRAL_BASELINE,
} from './geometry.js';
import { ProctoringRules } from './proctoringRules.js';
import { PROCTORING_POLICY } from './policy.js';
import { rmsToDb, computeRms, isVoice } from './audioMeter.js';
import { skinRatio, meanLuma } from './basicPresence.js';

const deg = (d) => (d * Math.PI) / 180;

/** Column-major 4x4 for rotation R = Ry(yaw) * Rx(-pitch) (pitch>0 = looking up). */
const matrixFor = (yawDeg, pitchDeg) => {
  const y = deg(yawDeg);
  const p = deg(pitchDeg);
  // forward vector f = (sin y cos p, sin p, cos y cos p)
  const f = [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
  const right = [Math.cos(y), 0, -Math.sin(y)];
  const up = [f[1] * right[2] - f[2] * right[1], f[2] * right[0] - f[0] * right[2], f[0] * right[1] - f[1] * right[0]];
  // columns: right, up, forward, translation
  return [...right, 0, ...up, 0, ...f, 0, 0, 0, -50, 1];
};

describe('head pose', () => {
  test('identity matrix is a frontal face', () => {
    const pose = poseFromMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -50, 1]);
    assert.ok(Math.abs(pose.yaw) < 1e-9 && Math.abs(pose.pitch) < 1e-9 && Math.abs(pose.roll) < 1e-9);
  });

  test('recovers yaw and pitch from the forward axis', () => {
    const pose = poseFromMatrix(matrixFor(35, -15));
    assert.ok(Math.abs(pose.yaw - 35) < 0.01, `yaw ${pose.yaw}`);
    assert.ok(Math.abs(pose.pitch + 15) < 0.01, `pitch ${pose.pitch}`);
  });

  test('rejects malformed matrices', () => {
    assert.equal(poseFromMatrix(null), null);
    assert.equal(poseFromMatrix([1, 2, 3]), null);
  });
});

describe('gaze and framing', () => {
  const cats = (o) => Object.entries(o).map(([categoryName, score]) => ({ categoryName, score }));

  test('blendshapes map to candidate-perspective gaze', () => {
    const left = gazeFromBlendshapes(cats({ eyeLookOutLeft: 0.8, eyeLookInRight: 0.8 }));
    assert.ok(left.x > 0.7 && left.available);
    const down = gazeFromBlendshapes(cats({ eyeLookDownLeft: 0.6, eyeLookDownRight: 0.6 }));
    assert.ok(down.y < -0.5);
    assert.equal(gazeFromBlendshapes([]).available, false);
  });

  test('bounding box and framing hints', () => {
    const box = boundingBox([{ x: 0.4, y: 0.3 }, { x: 0.6, y: 0.7 }, { x: 0.5, y: 0.5 }]);
    assert.deepEqual(
      Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      { x: 0.4, y: 0.3, w: 0.2, h: 0.4 }
    );
    assert.equal(framingOf(box).centered, true);
    assert.equal(framingOf({ x: 0.45, y: 0.4, w: 0.08, h: 0.1 }).distance, 'far');
    assert.equal(framingOf({ x: 0.0, y: 0.2, w: 0.3, h: 0.4 }).centered, false);
    assert.equal(framingOf(null).hint, 'No face in view');
  });
});

describe('attention classification', () => {
  const P = PROCTORING_POLICY;
  const gaze = (x = 0, y = 0, blink = 0) => ({ x, y, blink, available: true });

  test('frontal face is attentive', () => {
    const a = classifyAttention({ pose: { yaw: 3, pitch: -4 }, gaze: gaze(0.1, -0.1), policy: P });
    assert.equal(a.away, false);
  });

  test('head turns and eye deviations are classified with direction', () => {
    assert.equal(classifyAttention({ pose: { yaw: 40, pitch: 0 }, gaze: gaze(), policy: P }).direction, 'left');
    assert.equal(classifyAttention({ pose: { yaw: -40, pitch: 0 }, gaze: gaze(), policy: P }).direction, 'right');
    assert.equal(classifyAttention({ pose: { yaw: 0, pitch: -30 }, gaze: gaze(), policy: P }).direction, 'down');
    const eyes = classifyAttention({ pose: { yaw: 0, pitch: 0 }, gaze: gaze(-0.7, 0), policy: P });
    assert.equal(eyes.direction, 'right');
    assert.equal(eyes.source, 'eyes');
  });

  test('calibrated baseline absorbs an off-centre camera', () => {
    const baseline = { yaw: 0, pitch: -25, gazeX: 0, gazeY: -0.2 };
    const a = classifyAttention({ pose: { yaw: 2, pitch: -27 }, gaze: gaze(0, -0.25), baseline, policy: P });
    assert.equal(a.away, false);
    const raw = classifyAttention({ pose: { yaw: 2, pitch: -27 }, gaze: gaze(0, -0.25), baseline: NEUTRAL_BASELINE, policy: P });
    assert.equal(raw.away, true);
  });

  test('blinks do not count as looking away and typing allows downward glances', () => {
    assert.equal(classifyAttention({ pose: { yaw: 0, pitch: 0 }, gaze: gaze(0, -0.9, 0.9), policy: P }).away, false);
    assert.equal(classifyAttention({ pose: { yaw: 0, pitch: -30 }, gaze: gaze(), policy: P, typing: true }).away, false);
    assert.equal(classifyAttention({ pose: { yaw: 40, pitch: 0 }, gaze: gaze(), policy: P, typing: true }).away, true);
  });

  test('partial head + eye turn in the same direction combines', () => {
    const a = classifyAttention({ pose: { yaw: 22, pitch: 0 }, gaze: gaze(0.4, 0), policy: P });
    assert.equal(a.away, true);
    assert.equal(a.source, 'combined');
  });

  test('baseline uses medians', () => {
    const b = baselineFromSamples([
      { yaw: 1, pitch: -10, gazeX: 0, gazeY: 0 },
      { yaw: 2, pitch: -11, gazeX: 0.1, gazeY: 0 },
      { yaw: 90, pitch: -12, gazeX: 0, gazeY: 0 },
    ]);
    assert.equal(b.yaw, 2);
    assert.equal(b.pitch, -11);
    assert.equal(b.samples, 3);
  });
});

describe('proctoring rules engine', () => {
  const caps = { faces: true, attention: true, objects: true, audio: true };
  const sample = (over = {}) => ({
    faceCount: 1,
    attention: { away: false },
    persons: 1,
    phone: false,
    voice: false,
    mouthMoving: false,
    dictating: false,
    capabilities: caps,
    ...over,
  });

  /** Feeds samples every `stepMs` from `from` to `to` (ms) and collects violations. */
  const run = (rules, from, to, make, stepMs = 100) => {
    const out = [];
    for (let t = from; t <= to; t += stepMs) out.push(...rules.update(make(t), t));
    return out;
  };

  test('uses wall-clock time, not frame counts (60 fps vs 5 fps agree)', () => {
    for (const step of [16, 200]) {
      const rules = new ProctoringRules();
      run(rules, 0, 5000, () => sample(), step);
      const early = run(rules, 5000 + step, 14_000, () => sample({ faceCount: 0 }), step);
      assert.equal(early.length, 0, `fired before 10s at step ${step}`);
      const fired = run(rules, 14_000 + step, 16_000, () => sample({ faceCount: 0 }), step);
      assert.equal(fired.length, 1, `step ${step}`);
      assert.equal(fired[0].eventType, 'person_out_of_frame');
    }
  });

  test('nothing fires during the start grace period', () => {
    const rules = new ProctoringRules();
    const v = run(rules, 0, 3500, () => sample({ faceCount: 2 }));
    assert.equal(v.length, 0);
  });

  test('brief look-aways reset; sustained ones fire with the right event type', () => {
    const rules = new ProctoringRules();
    run(rules, 0, 5000, () => sample());
    // 3s away, back, 3s away: never 5s continuous
    let v = run(rules, 5100, 8000, () => sample({ attention: { away: true, direction: 'left', source: 'head' } }));
    v = v.concat(run(rules, 8100, 8500, () => sample()));
    v = v.concat(run(rules, 8600, 11_500, () => sample({ attention: { away: true, direction: 'left', source: 'head' } })));
    assert.equal(v.length, 0);
    const fired = run(rules, 11_600, 15_000, () => sample({ attention: { away: true, direction: 'down', source: 'eyes' } }));
    assert.equal(fired.length, 1);
    assert.equal(fired[0].eventType, 'eye_gaze_deviated');
    assert.match(fired[0].message, /down/);
  });

  test('cooldowns stop a persisting condition from spamming warnings', () => {
    const rules = new ProctoringRules();
    run(rules, 0, 5000, () => sample());
    const v = run(rules, 5100, 30_000, () => sample({ phone: true }));
    // fires at ~6.6s, then the 15s group cooldown, then again
    assert.equal(v.length, 2);
    assert.ok(v.every((x) => x.eventType === 'phone_detected'));
  });

  test('multiple faces take precedence over the person detector', () => {
    const rules = new ProctoringRules();
    run(rules, 0, 5000, () => sample());
    const v = run(rules, 5100, 9000, () => sample({ faceCount: 2, persons: 2 }));
    assert.equal(v.length, 1);
    assert.equal(v[0].eventType, 'multiple_faces_detected');
  });

  test('voices while the candidate is silent are flagged; dictation and own speech are not', () => {
    const r1 = new ProctoringRules();
    run(r1, 0, 5000, () => sample());
    assert.equal(run(r1, 5100, 12_000, () => sample({ voice: true, mouthMoving: true })).length, 0);
    assert.equal(run(r1, 12_100, 19_000, () => sample({ voice: true, mouthMoving: false, dictating: true })).length, 0);
    const v = run(r1, 19_100, 26_000, () => sample({ voice: true, mouthMoving: false }));
    assert.equal(v.length, 1);
    assert.equal(v[0].eventType, 'audio_anomaly_detected');
  });

  test('disabled capabilities never fire', () => {
    const rules = new ProctoringRules();
    const off = { faces: false, attention: false, objects: false, audio: false };
    const v = run(rules, 0, 60_000, () => sample({ faceCount: 0, phone: true, persons: 3, voice: true, capabilities: off }));
    assert.equal(v.length, 0);
  });

  test('summary reports attention and presence percentages', () => {
    const rules = new ProctoringRules();
    run(rules, 0, 10_000, () => sample());
    run(rules, 10_100, 20_000, () => sample({ attention: { away: true, direction: 'left' } }));
    const s = rules.summary('mediapipe', true);
    assert.equal(s.engine, 'mediapipe');
    assert.equal(s.facePresentPct, 100);
    assert.ok(s.attentionPct > 45 && s.attentionPct < 55, `attention ${s.attentionPct}`);
    assert.equal(s.monitoredSeconds, 20);
  });

  test('progress exposes pending countdowns', () => {
    const rules = new ProctoringRules();
    run(rules, 0, 5000, () => sample());
    run(rules, 5100, 8100, () => sample({ faceCount: 0 }));
    const p = rules.progress(8100);
    assert.ok(Math.abs(p.absent.elapsed - 3) < 0.01);
    assert.equal(p.absent.threshold, 10);
  });
});

describe('audio and pixel helpers', () => {
  test('RMS to dBFS', () => {
    assert.equal(Math.round(rmsToDb(1)), 0);
    assert.equal(Math.round(rmsToDb(0.1)), -20);
    assert.equal(rmsToDb(0), -100);
    assert.ok(Math.abs(computeRms([0.5, -0.5, 0.5, -0.5]) - 0.5) < 1e-9);
  });

  test('voice detection is relative to the noise floor', () => {
    const P = PROCTORING_POLICY;
    assert.equal(isVoice(-30, -55, P), true);
    assert.equal(isVoice(-45, -55, P), false);
    assert.equal(isVoice(-30, -40, P), false);
  });

  test('skin ratio and luma', () => {
    const w = 10;
    const h = 10;
    const skin = new Uint8ClampedArray(w * h * 4);
    const wall = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
      skin.set([205, 150, 125, 255], i * 4);
      wall.set([60, 90, 160, 255], i * 4);
    }
    assert.ok(skinRatio(skin, w, h) > 0.9);
    assert.equal(skinRatio(wall, w, h), 0);
    assert.ok(Math.abs(meanLuma(new Uint8ClampedArray([255, 255, 255, 255])) - 255) < 1e-9);
  });
});
