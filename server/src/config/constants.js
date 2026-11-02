/**
 * Domain constants shared by models, controllers, and the AI layer.
 * Keep these in sync with client/src/lib/constants.js.
 */

export const TARGET_ROLES = [
  'Software Development Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Analyst',
  'Java Developer',
  'Python Developer',
  'DevOps Engineer',
];

export const EXPERIENCE_LEVELS = ['Entry-Level', 'Junior', 'Mid-Level', 'Senior'];

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const INTERVIEW_TYPES = ['Technical', 'HR', 'Behavioral', 'Mixed'];

export const QUESTION_TYPES = ['Technical', 'HR', 'Behavioral'];

export const TOPICS = [
  'Data Structures & Algorithms',
  'Database Management Systems',
  'Operating Systems',
  'Computer Networks',
  'System Design',
  'Object-Oriented Programming',
  'JavaScript & TypeScript',
  'React & Frontend Architecture',
  'Node.js & Backend Architecture',
  'SQL & Data Modeling',
  'Python Programming',
  'Java & Spring Boot',
  'HR & Behavioral',
];

export const INTERVIEW_LIMITS = {
  minQuestions: 1,
  maxQuestions: 10,
  minDurationMinutes: 5,
  maxDurationMinutes: 90,
  maxTopics: 8,
  maxAnswerLength: 8000,
  // Answers that arrive this long after the deadline are still accepted, to
  // absorb network latency and slow AI evaluation of a last-second submit.
  answerGraceSeconds: 60,
};

export const MAX_PROCTORING_WARNINGS = 5;

/**
 * Severity is decided by the server, never by the client.
 * - info:     recorded in the audit trail, does not count toward the limit
 * - warning:  counts toward MAX_PROCTORING_WARNINGS
 * - critical: ends the interview immediately
 */
export const MONITORING_EVENT_SEVERITY = {
  // Presence & attention (computer vision)
  no_face_detected: 'warning',
  person_out_of_frame: 'warning',
  multiple_faces_detected: 'warning',
  additional_person_detected: 'warning',
  phone_detected: 'warning',
  head_turned_away: 'warning',
  looking_off_screen: 'warning',
  eye_gaze_deviated: 'warning',
  audio_anomaly_detected: 'warning',
  // Browser environment
  window_blurred: 'warning',
  keyboard_shortcut_violation: 'warning',
  paste_attempt: 'warning',
  camera_disconnected: 'warning',
  proctoring_violation: 'warning',
  // Hard stops
  tab_switched: 'critical',
  fullscreen_exit: 'critical',
  window_focus_lost: 'critical',
  max_warnings_exceeded: 'critical',
  // Informational
  proctoring_started: 'info',
  camera_unavailable: 'info',
  fullscreen_unavailable: 'info',
  vision_engine_degraded: 'info',
};

export const MONITORING_EVENT_TYPES = Object.keys(MONITORING_EVENT_SEVERITY);

export const CV_ENGINES = ['mediapipe', 'basic', 'none'];

export const END_REASONS = ['all_answered', 'submitted_early', 'time_expired', 'proctoring'];
