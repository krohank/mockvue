import { PROCTORING_POLICY, VIOLATION_MESSAGES } from './policy.js';

/**
 * Time-based rules engine. Feed it one sample per analysed frame; it measures
 * how long each condition has held using real timestamps (not frame counts),
 * applies cooldowns, and returns violations to report.
 *
 * Sample shape:
 * {
 *   faceCount: number | null        // null = vision not available this tick
 *   attention: { away, direction, source } | null
 *   persons: number | null          // from the object detector (includes the candidate)
 *   phone: boolean | null
 *   voice: boolean                  // voice-level audio above noise floor
 *   mouthMoving: boolean | null
 *   dictating: boolean
 *   capabilities: { faces, attention, objects, audio }
 * }
 */

const RULES = [
  {
    id: 'absent',
    eventType: 'person_out_of_frame',
    group: 'presence',
    seconds: (p) => p.absenceSeconds,
    active: (s) => s.capabilities.faces && s.faceCount === 0,
  },
  {
    id: 'multipleFaces',
    eventType: 'multiple_faces_detected',
    group: 'people',
    seconds: (p) => p.multipleFacesSeconds,
    active: (s) => s.capabilities.faces && s.faceCount > 1,
    metadata: (s) => ({ faceCount: s.faceCount }),
  },
  {
    id: 'extraPerson',
    eventType: 'additional_person_detected',
    group: 'people',
    seconds: (p) => p.extraPersonSeconds,
    // The detector also sees the candidate, so 2+ bodies means someone else is present.
    active: (s) => s.capabilities.objects && s.persons !== null && s.persons >= 2 && !(s.faceCount > 1),
    metadata: (s) => ({ persons: s.persons }),
  },
  {
    id: 'phone',
    eventType: 'phone_detected',
    group: 'objects',
    seconds: (p) => p.phoneSeconds,
    active: (s) => s.capabilities.objects && s.phone === true,
    metadata: (s) => ({ label: 'cell phone', score: s.phoneScore ?? null }),
  },
  {
    id: 'lookAway',
    eventType: (s) => (s.attention?.source === 'eyes' ? 'eye_gaze_deviated' : 'head_turned_away'),
    group: 'attention',
    seconds: (p) => p.lookAwaySeconds,
    active: (s) => s.capabilities.attention && s.faceCount === 1 && Boolean(s.attention?.away),
    metadata: (s) => ({
      direction: s.attention?.direction,
      source: s.attention?.source,
      yaw: s.attention?.yawDev,
      pitch: s.attention?.pitchDev,
    }),
  },
  {
    id: 'voiceWhileSilent',
    eventType: 'audio_anomaly_detected',
    group: 'audio',
    seconds: (p) => p.voiceWhileSilentSeconds,
    active: (s) => s.capabilities.audio && s.voice && !s.dictating && s.faceCount === 1 && s.mouthMoving === false,
  },
];

export class ProctoringRules {
  constructor(policy = PROCTORING_POLICY) {
    this.policy = policy;
    this.reset();
  }

  reset(now = null) {
    this.startedAt = now;
    this.lastSampleAt = null;
    this.since = {}; // rule id -> timestamp the condition became true
    this.cooldownUntil = {}; // group -> timestamp
    this.lastWarningAt = -Infinity;
    this.stats = {
      framesAnalyzed: 0,
      monitoredMs: 0,
      visionMs: 0,
      facePresentMs: 0,
      attentiveMs: 0,
      multiplePeopleMs: 0,
      speakingMs: 0,
      phoneDetections: 0,
    };
    this.lastPhone = false;
  }

  /** Seconds each pending condition has been active (for live countdown UI). */
  progress(now) {
    const out = {};
    for (const rule of RULES) {
      if (this.since[rule.id] !== undefined) {
        const elapsed = (now - this.since[rule.id]) / 1000;
        out[rule.id] = { elapsed, threshold: rule.seconds(this.policy) };
      }
    }
    return out;
  }

  #accumulate(sample, now) {
    const s = this.stats;
    s.framesAnalyzed += 1;
    if (this.lastSampleAt === null) {
      this.lastSampleAt = now;
      return;
    }
    // Cap gaps (e.g. a throttled background tab) so they don't skew percentages.
    const dt = Math.min(1000, Math.max(0, now - this.lastSampleAt));
    this.lastSampleAt = now;
    s.monitoredMs += dt;
    if (sample.capabilities.faces && sample.faceCount !== null) {
      s.visionMs += dt;
      if (sample.faceCount >= 1) s.facePresentMs += dt;
      if (sample.faceCount === 1 && !sample.attention?.away) s.attentiveMs += dt;
      if (sample.faceCount > 1 || (sample.persons ?? 0) >= 2) s.multiplePeopleMs += dt;
    }
    if (sample.voice) s.speakingMs += dt;
    if (sample.phone && !this.lastPhone) s.phoneDetections += 1;
    this.lastPhone = Boolean(sample.phone);
  }

  update(sample, now) {
    if (this.startedAt === null) this.startedAt = now;
    this.#accumulate(sample, now);

    const p = this.policy;
    const violations = [];
    const inGrace = now - this.startedAt < p.startGraceSeconds * 1000;

    for (const rule of RULES) {
      const isActive = Boolean(rule.active(sample));
      if (!isActive) {
        delete this.since[rule.id];
        continue;
      }
      if (this.since[rule.id] === undefined) this.since[rule.id] = now;

      const elapsedMs = now - this.since[rule.id];
      const thresholdMs = rule.seconds(p) * 1000;
      if (inGrace || elapsedMs < thresholdMs) continue;
      if (now < (this.cooldownUntil[rule.group] || 0)) continue;
      if (now - this.lastWarningAt < p.globalCooldownSeconds * 1000) continue;

      const seconds = Math.round(elapsedMs / 1000);
      const eventType = typeof rule.eventType === 'function' ? rule.eventType(sample) : rule.eventType;
      const metadata = rule.metadata ? rule.metadata(sample) : undefined;
      violations.push({
        rule: rule.id,
        eventType,
        durationSeconds: seconds,
        metadata,
        message: VIOLATION_MESSAGES[eventType]?.(seconds, metadata) || eventType.replace(/_/g, ' '),
      });

      this.lastWarningAt = now;
      this.cooldownUntil[rule.group] = now + p.ruleCooldownSeconds * 1000;
      // Restart the clock so a persisting condition must hold again to re-fire.
      this.since[rule.id] = now;
    }

    return violations;
  }

  summary(engine = 'none', calibrated = false) {
    const s = this.stats;
    const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);
    return {
      engine,
      calibrated,
      framesAnalyzed: s.framesAnalyzed,
      monitoredSeconds: Math.round(s.monitoredMs / 1000),
      facePresentPct: pct(s.facePresentMs, s.visionMs),
      attentionPct: pct(s.attentiveMs, s.visionMs),
      multiplePeoplePct: pct(s.multiplePeopleMs, s.visionMs),
      speakingPct: pct(s.speakingMs, s.monitoredMs),
      phoneDetections: s.phoneDetections,
    };
  }
}
