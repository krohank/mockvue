/**
 * Pure geometry helpers for MediaPipe Face Landmarker output.
 * No browser APIs — unit-tested with `node --test`.
 *
 * Conventions (candidate's perspective, i.e. what they would call left/right):
 *   yaw   > 0  → head turned to the candidate's left
 *   pitch > 0  → head tilted up
 *   gaze.x > 0 → eyes looking to the candidate's left
 *   gaze.y > 0 → eyes looking up
 */

const RAD2DEG = 180 / Math.PI;

export const LANDMARK = {
  noseTip: 1,
  forehead: 10,
  chin: 152,
  faceRightEdge: 234, // candidate's right cheek (image left in a raw camera frame)
  faceLeftEdge: 454,
  rightEyeOuter: 33,
  rightEyeInner: 133,
  leftEyeInner: 362,
  leftEyeOuter: 263,
  rightEyeUpper: 159,
  rightEyeLower: 145,
  leftEyeUpper: 386,
  leftEyeLower: 374,
  rightIris: 468,
  leftIris: 473,
};

/**
 * Head pose from MediaPipe's 4×4 facial transformation matrix (column-major).
 * The face's forward axis in camera space is the 3rd column of the rotation.
 * Camera space: +x = image right (candidate's left), +y = up, +z = toward camera.
 */
export const poseFromMatrix = (data) => {
  if (!data || data.length < 16) return null;
  const fx = data[8];
  const fy = data[9];
  const fz = data[10];
  if (![fx, fy, fz].every(Number.isFinite) || fz === 0) return null;
  return {
    yaw: Math.atan2(fx, fz) * RAD2DEG,
    pitch: Math.atan2(fy, Math.hypot(fx, fz)) * RAD2DEG,
    roll: Math.atan2(data[1], data[0]) * RAD2DEG,
  };
};

/**
 * Fallback head pose from 3D landmarks when the matrix is unavailable.
 * Landmark x/z are normalised by image width and y by height, so convert to
 * a common pixel scale first.
 */
export const poseFromLandmarks = (lm, width = 640, height = 480) => {
  if (!lm || lm.length < 455) return null;
  const P = (i) => ({ x: lm[i].x * width, y: lm[i].y * height, z: (lm[i].z || 0) * width });
  const r = P(LANDMARK.faceRightEdge);
  const l = P(LANDMARK.faceLeftEdge);
  const top = P(LANDMARK.forehead);
  const chin = P(LANDMARK.chin);
  // Turning to the candidate's left pushes their left cheek (image right) away from the camera (larger z).
  const yaw = Math.atan2(l.z - r.z, l.x - r.x) * RAD2DEG;
  const pitch = Math.atan2(chin.z - top.z, chin.y - top.y) * RAD2DEG;
  const roll = Math.atan2(l.y - r.y, l.x - r.x) * RAD2DEG;
  return { yaw, pitch, roll };
};

const blendMap = (categories) => {
  const map = {};
  for (const c of categories || []) map[c.categoryName] = c.score;
  return map;
};

/** Eye gaze and facial activity from ARKit-style blendshapes. */
export const gazeFromBlendshapes = (categories) => {
  const b = blendMap(categories);
  const v = (k) => b[k] || 0;
  return {
    x: ((v('eyeLookOutLeft') + v('eyeLookInRight')) - (v('eyeLookInLeft') + v('eyeLookOutRight'))) / 2,
    y: ((v('eyeLookUpLeft') + v('eyeLookUpRight')) - (v('eyeLookDownLeft') + v('eyeLookDownRight'))) / 2,
    blink: Math.max(v('eyeBlinkLeft'), v('eyeBlinkRight')),
    jawOpen: v('jawOpen'),
    available: Object.keys(b).length > 0,
  };
};

/** Normalised [0..1] bounding box of a landmark set. */
export const boundingBox = (lm) => {
  if (!lm || lm.length === 0) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/** Where the face sits in the frame; used for "move closer / centre yourself" hints. */
export const framingOf = (box) => {
  if (!box) return { centered: false, distance: 'unknown', hint: 'No face in view' };
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const centered = cx > 0.25 && cx < 0.75 && cy > 0.2 && cy < 0.8;
  let distance = 'ok';
  if (box.w < 0.14) distance = 'far';
  else if (box.w > 0.62) distance = 'close';
  let hint = null;
  if (distance === 'far') hint = 'Move a little closer to the camera';
  else if (distance === 'close') hint = 'Move back from the camera';
  else if (!centered) hint = 'Centre your face in the frame';
  return { centered, distance, hint };
};

const median = (values) => {
  const arr = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
};

/** Neutral pose from calibration samples (robust to a few outliers). */
export const baselineFromSamples = (samples) => ({
  yaw: median(samples.map((s) => s.yaw)),
  pitch: median(samples.map((s) => s.pitch)),
  gazeX: median(samples.map((s) => s.gazeX)),
  gazeY: median(samples.map((s) => s.gazeY)),
  samples: samples.length,
});

export const NEUTRAL_BASELINE = { yaw: 0, pitch: 0, gazeX: 0, gazeY: 0, samples: 0 };

/**
 * Decides whether the candidate is looking away from the screen.
 * Head turns dominate; eye-only deviations count only when the eyes are open.
 * Looking down while actively typing is allowed (people glance at keyboards).
 */
export const classifyAttention = ({ pose, gaze, baseline = NEUTRAL_BASELINE, policy, typing = false }) => {
  if (!pose) return { away: false, direction: null, source: null, yawDev: 0, pitchDev: 0, gazeX: 0, gazeY: 0 };

  const yawDev = pose.yaw - (baseline.yaw || 0);
  const pitchDev = pose.pitch - (baseline.pitch || 0);
  const eyesUsable = gaze?.available && gaze.blink < policy.blinkThreshold;
  const gx = eyesUsable ? gaze.x - (baseline.gazeX || 0) : 0;
  const gy = eyesUsable ? gaze.y - (baseline.gazeY || 0) : 0;

  let direction = null;
  let source = null;

  if (Math.abs(yawDev) > policy.maxYawDeg) {
    direction = yawDev > 0 ? 'left' : 'right';
    source = 'head';
  } else if (pitchDev < -policy.maxPitchDownDeg) {
    direction = 'down';
    source = 'head';
  } else if (pitchDev > policy.maxPitchUpDeg) {
    direction = 'up';
    source = 'head';
  } else if (Math.abs(gx) > policy.maxGazeX) {
    direction = gx > 0 ? 'left' : 'right';
    source = 'eyes';
  } else if (gy < -policy.maxGazeDown) {
    direction = 'down';
    source = 'eyes';
  } else if (gy > policy.maxGazeUp) {
    direction = 'up';
    source = 'eyes';
  } else {
    // Head and eyes each partly turned the same way add up to looking away.
    const yawFrac = yawDev / policy.maxYawDeg;
    const gazeFrac = gx / policy.maxGazeX;
    if (Math.sign(yawFrac) === Math.sign(gazeFrac) && Math.abs(yawFrac) + Math.abs(gazeFrac) > 1.3) {
      direction = yawFrac > 0 ? 'left' : 'right';
      source = 'combined';
    }
  }

  if (direction === 'down' && typing && policy.allowDownwardGlanceWhileTyping) {
    direction = null;
    source = null;
  }

  return { away: Boolean(direction), direction, source, yawDev, pitchDev, gazeX: gx, gazeY: gy };
};
