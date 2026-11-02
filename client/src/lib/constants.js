// Keep in sync with server/src/config/constants.js
export const TARGET_ROLES = [
  { value: 'Software Development Engineer', short: 'SDE', desc: 'DSA, system design, OS and networks' },
  { value: 'Frontend Developer', short: 'Frontend', desc: 'JavaScript, React, browser performance' },
  { value: 'Backend Developer', short: 'Backend', desc: 'APIs, databases, distributed systems' },
  { value: 'Full Stack Developer', short: 'Full stack', desc: 'End-to-end web, data modeling, REST' },
  { value: 'Data Analyst', short: 'Data', desc: 'SQL, Python, metrics and modeling' },
  { value: 'Java Developer', short: 'Java', desc: 'Core Java, OOP, Spring Boot, concurrency' },
  { value: 'Python Developer', short: 'Python', desc: 'Python internals, async, web backends' },
  { value: 'DevOps Engineer', short: 'DevOps', desc: 'Networks, OS, scaling and reliability' },
];

export const EXPERIENCE_LEVELS = [
  { value: 'Entry-Level', label: 'Entry level', desc: 'Campus placements, fresh graduate' },
  { value: 'Junior', label: 'Junior', desc: '0–2 years of experience' },
  { value: 'Mid-Level', label: 'Mid level', desc: '2–5 years of experience' },
  { value: 'Senior', label: 'Senior', desc: '5+ years of experience' },
];

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

export const TOPIC_SHORT = {
  'Data Structures & Algorithms': 'DSA',
  'Database Management Systems': 'DBMS',
  'Operating Systems': 'OS',
  'Computer Networks': 'Networks',
  'System Design': 'System design',
  'Object-Oriented Programming': 'OOP',
  'JavaScript & TypeScript': 'JS / TS',
  'React & Frontend Architecture': 'React',
  'Node.js & Backend Architecture': 'Node.js',
  'SQL & Data Modeling': 'SQL',
  'Python Programming': 'Python',
  'Java & Spring Boot': 'Java',
  'HR & Behavioral': 'HR & behavioral',
};

/** Topics suggested first for each role. */
export const ROLE_TOPICS = {
  'Software Development Engineer': ['Data Structures & Algorithms', 'System Design', 'Operating Systems', 'Database Management Systems'],
  'Frontend Developer': ['JavaScript & TypeScript', 'React & Frontend Architecture', 'Computer Networks'],
  'Backend Developer': ['Node.js & Backend Architecture', 'Database Management Systems', 'System Design', 'SQL & Data Modeling'],
  'Full Stack Developer': ['JavaScript & TypeScript', 'React & Frontend Architecture', 'Node.js & Backend Architecture', 'SQL & Data Modeling'],
  'Data Analyst': ['SQL & Data Modeling', 'Python Programming', 'Database Management Systems'],
  'Java Developer': ['Java & Spring Boot', 'Object-Oriented Programming', 'Data Structures & Algorithms'],
  'Python Developer': ['Python Programming', 'Data Structures & Algorithms', 'Database Management Systems'],
  'DevOps Engineer': ['Operating Systems', 'Computer Networks', 'System Design'],
};

export const DIFFICULTIES = [
  { value: 'Easy', desc: 'Definitions and core mechanics' },
  { value: 'Medium', desc: 'Typical campus placement bar, with trade-offs' },
  { value: 'Hard', desc: 'Scale, concurrency and failure modes' },
];

export const INTERVIEW_TYPES = [
  { value: 'Technical', desc: 'Concepts and problem solving' },
  { value: 'Mixed', desc: 'Technical plus one behavioral question' },
  { value: 'Behavioral', desc: 'STAR-style stories about your experience' },
  { value: 'HR', desc: 'Motivation, priorities and fit' },
];

export const RUBRIC = [
  { key: 'technicalCorrectness', label: 'Technical correctness', short: 'Technical', max: 40, desc: 'Accurate concepts, mechanisms and complexity' },
  { key: 'relevance', label: 'Relevance', short: 'Relevance', max: 20, desc: 'Answers what was asked, without filler' },
  { key: 'completeness', label: 'Completeness', short: 'Completeness', max: 20, desc: 'Covers key concepts, edge cases and trade-offs' },
  { key: 'clarity', label: 'Clarity', short: 'Clarity', max: 20, desc: 'Structured, precise and easy to follow' },
];

export const PRESETS = [
  {
    id: 'dsa-warmup',
    title: 'DSA warm-up',
    desc: '3 questions · 15 min',
    config: { topics: ['Data Structures & Algorithms'], difficulty: 'Easy', interviewType: 'Technical', questionCount: 3, durationMinutes: 15 },
  },
  {
    id: 'sde-full',
    title: 'Full SDE round',
    desc: '5 questions · 25 min',
    config: {
      targetRole: 'Software Development Engineer',
      topics: ['Data Structures & Algorithms', 'System Design', 'Operating Systems', 'Database Management Systems'],
      difficulty: 'Medium',
      interviewType: 'Mixed',
      questionCount: 5,
      durationMinutes: 25,
    },
  },
  {
    id: 'hr-round',
    title: 'HR round',
    desc: '3 questions · 15 min',
    config: { topics: ['HR & Behavioral'], difficulty: 'Medium', interviewType: 'Behavioral', questionCount: 3, durationMinutes: 15 },
  },
];

export const MAX_ANSWER_LENGTH = 8000;
