/**
 * Proctoring policy — every threshold the rules engine uses lives here so the
 * behaviour is easy to audit and tune. Times are in seconds.
 */
export const PROCTORING_POLICY = {
  maxWarnings: 5,

  // Presence & attention
  absenceSeconds: 10, // no face in frame
  lookAwaySeconds: 5, // head or eyes directed away from the screen
  multipleFacesSeconds: 2,
  extraPersonSeconds: 2.5, // body detected by the object model beyond the candidate
  phoneSeconds: 1.5,

  // Audio: someone talking while the candidate's mouth is not moving
  voiceWhileSilentSeconds: 6,
  voiceMarginDb: 14, // above the calibrated noise floor
  minVoiceDb: -42, // absolute floor so a silent room never counts as voice

  // Head-pose / gaze limits, relative to the calibrated neutral pose
  maxYawDeg: 30,
  maxPitchDownDeg: 22,
  maxPitchUpDeg: 20,
  maxGazeX: 0.5,
  maxGazeDown: 0.5,
  maxGazeUp: 0.7, // smiling/squinting reads as 'up'; looking up is rarely a concern
  blinkThreshold: 0.5,

  // Fairness
  startGraceSeconds: 4, // nothing fires right after monitoring starts
  ruleCooldownSeconds: 15, // same rule cannot fire again within this window
  globalCooldownSeconds: 4, // minimum gap between any two warnings
  allowDownwardGlanceWhileTyping: true,
  typingWindowMs: 1500,

  // Browser environment
  blurGraceMs: 1500, // brief focus loss = warning; longer = termination

  // Engine cadence
  faceIntervalMs: 66, // ~15 fps
  objectIntervalMs: 800,
  brightnessIntervalMs: 1000,
  objectHoldMs: 1200, // reuse the last object result this long
  phoneScoreThreshold: 0.45,
  personScoreThreshold: 0.55,
};

export const VIOLATION_MESSAGES = {
  person_out_of_frame: (s) => `No face detected for ${s}s. Stay in view of the camera.`,
  multiple_faces_detected: (s, m) => `${m?.faceCount || 'Multiple'} faces detected for ${s}s. Only you may be in frame.`,
  additional_person_detected: (s) => `Another person was detected in the room for ${s}s.`,
  phone_detected: () => 'A mobile phone was detected in view of the camera.',
  head_turned_away: (s, m) => `Head turned ${m?.direction || 'away'} from the screen for ${s}s.`,
  eye_gaze_deviated: (s, m) => `Eyes directed ${m?.direction || 'away'} from the screen for ${s}s.`,
  audio_anomaly_detected: (s) => `Voices detected for ${s}s while you were not speaking.`,
};
