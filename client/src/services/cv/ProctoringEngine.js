import { loadVisionRuntime, nextTimestamp, resetVisionRuntime } from './visionRuntime.js';
import {
  poseFromMatrix,
  poseFromLandmarks,
  gazeFromBlendshapes,
  boundingBox,
  framingOf,
  classifyAttention,
  baselineFromSamples,
  NEUTRAL_BASELINE,
} from './geometry.js';
import { AudioMeter, isVoice } from './audioMeter.js';
import { drawOverlay, clearOverlay } from './overlay.js';
import { PROCTORING_POLICY } from './policy.js';
import { FrameSampler, skinRatio, meanLuma } from './basicPresence.js';

/**
 * Real-time, on-device proctoring vision engine.
 *
 *   video ──► FaceLandmarker (478 landmarks, blendshapes, head pose)  ~15 fps
 *         ──► ObjectDetector  (phones, extra people)                   ~1 fps
 *         ──► luminance sampler (lighting)                             ~1 fps
 *   mic   ──► AudioMeter (dBFS, voice activity)
 *
 * Emits one `frame` object per analysis tick via `onFrame`. Nothing leaves the
 * browser: frames are analysed in memory and discarded.
 */
export class ProctoringEngine {
  constructor({
    video,
    canvas = null,
    policy = PROCTORING_POLICY,
    baseline = NEUTRAL_BASELINE,
    noiseFloorDb = null,
    showMesh = true,
    onFrame = () => {},
    onStatus = () => {},
  }) {
    this.video = video;
    this.canvas = canvas;
    this.policy = policy;
    this.baseline = baseline || NEUTRAL_BASELINE;
    this.noiseFloorDb = noiseFloorDb;
    this.showMesh = showMesh;
    this.onFrame = onFrame;
    this.onStatus = onStatus;

    this.mode = 'none'; // 'mediapipe' | 'basic' | 'none'
    this.status = { state: 'idle', message: '' };
    this.runtime = null;
    this.audio = null;
    this.sampler = new FrameSampler();

    this.running = false;
    this.rafId = null;
    this.lastFaceAt = 0;
    this.lastObjectAt = 0;
    this.lastBrightnessAt = 0;
    this.consecutiveErrors = 0;
    this.recovering = false;
    this.faceMsAvg = null;
    this.faceInterval = policy.faceIntervalMs;
    this.objects = { list: [], at: -Infinity };
    this.brightness = null;
    this.lastTypingAt = -Infinity;
    this.dictating = false;
    this.jawHistory = [];
    this.calibration = null;
    this.lastFrame = null;
  }

  #setStatus(state, message = '') {
    this.status = { state, message };
    this.onStatus(this.status);
  }

  async init() {
    this.#setStatus('loading', 'Loading vision models…');
    try {
      this.runtime = await loadVisionRuntime((stage) => this.#setStatus('loading', `${stage}…`));
      this.mode = 'mediapipe';
      this.#setStatus(
        'ready',
        this.runtime.objectDetector ? 'Face, gaze and object detection active' : 'Face and gaze detection active'
      );
    } catch (err) {
      console.warn('[Vision] Falling back to basic presence detection:', err?.message || err);
      this.mode = 'basic';
      this.#setStatus('basic', 'Advanced vision is unavailable on this device. Using basic presence detection.');
    }
    return this.mode;
  }

  attachStream(stream) {
    this.audio?.close();
    this.audio = stream ? new AudioMeter(stream) : null;
  }

  setBaseline(baseline) {
    this.baseline = baseline || NEUTRAL_BASELINE;
  }

  setNoiseFloor(db) {
    this.noiseFloorDb = db;
  }

  noteTyping() {
    this.lastTypingAt = performance.now();
  }

  setDictating(value) {
    this.dictating = Boolean(value);
  }

  get capabilities() {
    return {
      faces: this.mode === 'mediapipe' || this.mode === 'basic',
      attention: this.mode === 'mediapipe',
      objects: this.mode === 'mediapipe' && Boolean(this.runtime?.objectDetector),
      audio: Boolean(this.audio?.available),
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now) => {
      if (!this.running) return;
      try {
        this.#tick(now);
        this.consecutiveErrors = 0;
      } catch (err) {
        this.consecutiveErrors += 1;
        if (this.consecutiveErrors === 1) console.warn('[Vision] frame error:', err?.message || err);
        if (this.consecutiveErrors >= 20 && !this.recovering) this.#recover();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /** Rebuilds the MediaPipe graphs after repeated failures; degrades to basic mode if that fails too. */
  async #recover() {
    this.recovering = true;
    this.#setStatus('loading', 'Restarting vision models…');
    try {
      await resetVisionRuntime();
      this.runtime = await loadVisionRuntime();
      this.mode = 'mediapipe';
      this.#setStatus('ready', 'Vision models restarted');
    } catch {
      this.mode = 'basic';
      this.#setStatus('basic', 'Advanced vision stopped working. Using basic presence detection.');
    } finally {
      this.consecutiveErrors = 0;
      this.recovering = false;
    }
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    clearOverlay(this.canvas);
  }

  destroy() {
    this.stop();
    this.audio?.close();
    this.audio = null;
  }

  /**
   * Records the candidate's neutral pose (looking at the screen) and the
   * room's noise floor. Resolves with the new baseline.
   */
  calibrate(durationMs = 2500) {
    return new Promise((resolve) => {
      this.calibration = { until: performance.now() + durationMs, samples: [], dbs: [], resolve };
    });
  }

  #finishCalibration() {
    const { samples, dbs, resolve } = this.calibration;
    this.calibration = null;
    const ok = samples.length >= 5;
    const baseline = ok ? baselineFromSamples(samples) : this.baseline;
    const sorted = dbs.filter(Number.isFinite).sort((a, b) => a - b);
    const noiseFloorDb = sorted.length ? sorted[Math.floor(sorted.length * 0.3)] : null;
    if (ok) this.baseline = baseline;
    if (noiseFloorDb !== null) this.noiseFloorDb = noiseFloorDb;
    resolve({ ok, baseline, noiseFloorDb, samples: samples.length });
  }

  #syncCanvasSize() {
    const { videoWidth, videoHeight } = this.video;
    if (this.canvas && videoWidth && (this.canvas.width !== videoWidth || this.canvas.height !== videoHeight)) {
      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;
    }
  }

  #analyzeFaces(now) {
    const { faceLandmarker } = this.runtime;
    const started = performance.now();
    const result = faceLandmarker.detectForVideo(this.video, nextTimestamp(now));
    // Adapt cadence so inference never takes more than ~40% of the main thread.
    const ms = performance.now() - started;
    this.faceMsAvg = this.faceMsAvg === null ? ms : this.faceMsAvg * 0.8 + ms * 0.2;
    this.faceInterval = Math.min(400, Math.max(this.policy.faceIntervalMs, this.faceMsAvg * 2.5));
    const vw = this.video.videoWidth || 640;
    const vh = this.video.videoHeight || 480;
    const typing = now - this.lastTypingAt < this.policy.typingWindowMs;

    const faces = (result.faceLandmarks || []).map((landmarks, i) => {
      const pose =
        poseFromMatrix(result.facialTransformationMatrixes?.[i]?.data) || poseFromLandmarks(landmarks, vw, vh);
      const gaze = gazeFromBlendshapes(result.faceBlendshapes?.[i]?.categories);
      const box = boundingBox(landmarks);
      return { landmarks, pose, gaze, box };
    });
    faces.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);

    const primary = faces[0] || null;
    if (primary) {
      primary.attention = classifyAttention({
        pose: primary.pose,
        gaze: primary.gaze,
        baseline: this.baseline,
        policy: this.policy,
        typing,
      });
      this.jawHistory.push({ t: now, v: primary.gaze.jawOpen });
    }
    this.jawHistory = this.jawHistory.filter((j) => now - j.t < 1200);
    return faces;
  }

  #analyzeObjects(now) {
    const { objectDetector } = this.runtime;
    const vw = this.video.videoWidth || 640;
    const vh = this.video.videoHeight || 480;
    const result = objectDetector.detectForVideo(this.video, nextTimestamp(now));
    const list = (result.detections || [])
      .map((d) => {
        const c = d.categories?.[0];
        const b = d.boundingBox;
        if (!c || !b) return null;
        return {
          label: c.categoryName,
          score: c.score,
          box: { x: b.originX / vw, y: b.originY / vh, w: b.width / vw, h: b.height / vh },
        };
      })
      .filter(Boolean);
    this.objects = { list, at: now };
  }

  #tick(now) {
    const video = this.video;
    if (!video || video.readyState < 2 || video.paused || !video.videoWidth) return;
    if (now - this.lastFaceAt < this.faceInterval) return;
    this.lastFaceAt = now;
    this.#syncCanvasSize();

    // Lighting (and basic-mode presence) from a tiny downsampled frame.
    let basicPresence = null;
    if (now - this.lastBrightnessAt >= this.policy.brightnessIntervalMs || this.mode === 'basic') {
      const px = this.sampler.sample(video);
      if (px) {
        if (now - this.lastBrightnessAt >= this.policy.brightnessIntervalMs) {
          this.brightness = meanLuma(px);
          this.lastBrightnessAt = now;
        }
        if (this.mode === 'basic') basicPresence = skinRatio(px, this.sampler.width, this.sampler.height) > 0.04;
      }
    }

    let faces = [];
    if (this.mode === 'mediapipe') {
      faces = this.#analyzeFaces(now);
      if (this.runtime.objectDetector && now - this.lastObjectAt >= this.policy.objectIntervalMs) {
        this.lastObjectAt = now;
        this.#analyzeObjects(now);
      }
    }

    const objectsFresh = now - this.objects.at <= this.policy.objectHoldMs;
    const objects = objectsFresh ? this.objects.list : [];
    const phoneDet = objects
      .filter((o) => o.label === 'cell phone' && o.score >= this.policy.phoneScoreThreshold)
      .sort((a, b) => b.score - a.score)[0];
    const persons = objectsFresh
      ? objects.filter((o) => o.label === 'person' && o.score >= this.policy.personScoreThreshold).length
      : null;

    const primary = faces[0] || null;
    const jaw = this.jawHistory.map((j) => j.v);
    const mouthMoving = primary
      ? jaw.length > 3 && (Math.max(...jaw) - Math.min(...jaw) > 0.06 || primary.gaze.jawOpen > 0.3)
      : null;

    const audioDb = this.audio?.available ? this.audio.read() : null;
    const voice = audioDb !== null && isVoice(audioDb, this.noiseFloorDb, this.policy);

    let faceCount = null;
    if (this.mode === 'mediapipe') faceCount = faces.length;
    else if (this.mode === 'basic' && basicPresence !== null) faceCount = basicPresence ? 1 : 0;

    const frame = {
      t: now,
      mode: this.mode,
      capabilities: this.capabilities,
      faceCount,
      faces,
      primary,
      attention: primary?.attention || null,
      framing: framingOf(primary?.box),
      objects,
      persons: this.capabilities.objects && objectsFresh ? persons : null,
      phone: this.capabilities.objects && objectsFresh ? Boolean(phoneDet) : null,
      phoneScore: phoneDet?.score ?? null,
      audioDb,
      voice,
      mouthMoving,
      dictating: this.dictating,
      brightness: this.brightness,
      lowLight: this.brightness !== null && this.brightness < 45,
      perf: {
        delegate: this.runtime?.delegate || null,
        inferenceMs: this.faceMsAvg === null ? null : Math.round(this.faceMsAvg),
        fps: Math.round(1000 / this.faceInterval),
      },
    };
    this.lastFrame = frame;

    if (this.calibration) {
      // Accept every single-face sample: the point is to learn this person's
      // neutral pose, which may look "away" relative to the default baseline.
      if (faceCount === 1 && primary?.pose) {
        this.calibration.samples.push({
          yaw: primary.pose.yaw,
          pitch: primary.pose.pitch,
          gazeX: primary.gaze.available ? primary.gaze.x : 0,
          gazeY: primary.gaze.available ? primary.gaze.y : 0,
        });
      }
      if (audioDb !== null) this.calibration.dbs.push(audioDb);
      if (now >= this.calibration.until) this.#finishCalibration();
    }

    if (this.mode === 'mediapipe') drawOverlay(this.canvas, frame, { showMesh: this.showMesh });
    this.onFrame(frame);
  }
}
