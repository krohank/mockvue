import User from '../models/User.js';
import Interview from '../models/Interview.js';
import Question from '../models/Question.js';
import Answer from '../models/Answer.js';
import MonitoringEvent from '../models/MonitoringEvent.js';

/**
 * Demo accounts for local development and viva demonstrations.
 * Only seeded when SEED_DEMO_DATA is enabled (default: every environment except production).
 */
export const DEMO_PASSWORD = 'password123';

const DEMO_ACCOUNTS = [
  {
    email: 'megenta.point@gmail.com',
    name: 'Magenta Point',
    targetRole: 'Software Development Engineer',
    experienceLevel: 'Mid-Level',
    preferredTopics: ['Data Structures & Algorithms', 'System Design', 'Database Management Systems'],
    bio: 'Full-stack developer preparing for senior technical rounds.',
  },
  {
    email: 'candidate@mockvue.edu',
    name: 'Aarav Sharma',
    targetRole: 'Software Development Engineer',
    experienceLevel: 'Entry-Level',
    preferredTopics: ['Data Structures & Algorithms', 'Operating Systems', 'System Design'],
    bio: 'Final-year B.Tech Computer Science student preparing for campus placements.',
  },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const criteria = (t, r, c, cl) => ({ technicalCorrectness: t, relevance: r, completeness: c, clarity: cl });
const total = (s) => s.technicalCorrectness + s.relevance + s.completeness + s.clarity;

const SAMPLE_SESSIONS = [
  {
    daysAgo: 6,
    title: 'Medium Technical Interview · Software Development Engineer',
    difficulty: 'Medium',
    topics: ['Operating Systems', 'Data Structures & Algorithms'],
    durationMinutes: 20,
    minutesUsed: 17,
    summary: { attentionPct: 88.5, facePresentPct: 97.2, multiplePeoplePct: 0, speakingPct: 12.1, phoneDetections: 0 },
    events: [
      { eventType: 'eye_gaze_deviated', description: 'Looked away from the screen for 5s (down).', metadata: { pitch: 21.4 } },
    ],
    items: [
      {
        topic: 'Operating Systems',
        difficulty: 'Medium',
        questionText: 'Describe the four necessary conditions for a deadlock. How does the Banker\'s Algorithm avoid deadlocks?',
        referenceConcepts: ['Mutual Exclusion', 'Hold and Wait', 'No Preemption', 'Circular Wait', 'Safe state verification'],
        evaluationCriteria: ['Lists all four Coffman conditions', 'Explains safe vs unsafe state', 'Describes how requests are simulated before granting'],
        responseText:
          'A deadlock needs mutual exclusion, hold and wait, no preemption and circular wait. The Banker\'s algorithm keeps the system in a safe state by checking, before granting a request, whether there is still some order in which every process can finish with the remaining resources.',
        scores: criteria(28, 16, 13, 15),
        correctConcepts: ['Mutual Exclusion', 'Hold and Wait', 'No Preemption', 'Circular Wait', 'Safe state verification'],
        missingConcepts: ['Need / Allocation / Available matrices', 'Cost of running the safety check'],
        feedback: 'Correct conditions and the core idea of a safe state. Walk through a small Need/Available example to show you can apply it.',
        improvedAnswer:
          'Name the four Coffman conditions, then explain that the Banker\'s algorithm tracks Max, Allocation, Need and Available. On each request it pretends to grant it and runs the safety algorithm; if no safe sequence exists the request waits. Mention its O(m·n²) cost and why real OSes rarely use it.',
        timeSpentSeconds: 240,
      },
      {
        topic: 'Data Structures & Algorithms',
        difficulty: 'Medium',
        questionText: 'How do HashMaps resolve collisions, and when does a bucket convert from a linked list to a balanced tree?',
        referenceConcepts: ['Chaining', 'Load factor', 'Treeify threshold (8)', 'Red-black tree O(log n)'],
        evaluationCriteria: ['Describes chaining', 'Mentions treeification threshold', 'Explains worst-case improvement'],
        responseText:
          'Collisions are handled with chaining: each bucket keeps a linked list. When the table passes the load factor of 0.75 it resizes. Java 8 converts a bucket into a red-black tree once it has 8 entries so worst-case lookup is O(log n) instead of O(n).',
        scores: criteria(31, 17, 15, 16),
        correctConcepts: ['Chaining', 'Load factor', 'Treeify threshold (8)', 'Red-black tree O(log n)'],
        missingConcepts: ['MIN_TREEIFY_CAPACITY (64)'],
        feedback: 'Strong and precise. Mention that treeification only happens when the table has at least 64 buckets.',
        improvedAnswer:
          'Add that buckets untreeify at 6 entries and that treeification requires capacity ≥ 64; otherwise the map resizes instead.',
        timeSpentSeconds: 180,
      },
    ],
  },
  {
    daysAgo: 3,
    title: 'Hard Technical Interview · Software Development Engineer',
    difficulty: 'Hard',
    topics: ['System Design', 'Computer Networks'],
    durationMinutes: 25,
    minutesUsed: 22,
    summary: { attentionPct: 92.4, facePresentPct: 99.1, multiplePeoplePct: 0, speakingPct: 8.6, phoneDetections: 0 },
    events: [],
    items: [
      {
        topic: 'System Design',
        difficulty: 'Hard',
        questionText: 'Explain the CAP and PACELC theorems. How do systems like Cassandra offer tunable consistency?',
        referenceConcepts: ['Partition tolerance', 'Eventual consistency', 'Quorum (R + W > N)', 'Latency vs consistency'],
        evaluationCriteria: ['Explains why partitions are unavoidable', 'Defines quorum formula', 'Explains PACELC'],
        responseText:
          'CAP says that during a network partition you must choose consistency or availability. PACELC adds that even without partitions you trade latency for consistency. Cassandra lets you pick read and write consistency levels; if R + W > N, reads see the latest write.',
        scores: criteria(30, 17, 14, 16),
        correctConcepts: ['Partition tolerance', 'Quorum (R + W > N)', 'Latency vs consistency'],
        missingConcepts: ['Hinted handoff and read repair', 'Concrete N=3 example'],
        feedback: 'Accurate summary. Use a worked example (N=3, QUORUM reads and writes) and mention how replicas converge.',
        improvedAnswer:
          'With N=3, QUORUM writes (W=2) and QUORUM reads (R=2) overlap on at least one replica, so reads observe the latest acknowledged write. Read repair and hinted handoff bring lagging replicas back in sync.',
        timeSpentSeconds: 300,
      },
      {
        topic: 'Computer Networks',
        difficulty: 'Hard',
        questionText: 'Trace what happens from typing a URL to the first byte of HTML, including DNS and TLS 1.3.',
        referenceConcepts: ['DNS resolution', 'TCP handshake', 'TLS 1.3 handshake', 'HTTP request'],
        evaluationCriteria: ['Traces DNS hierarchy', 'Explains TLS key exchange', 'Mentions HTTP/2 or HTTP/3'],
        responseText:
          'The browser checks its DNS cache, then the OS, then a recursive resolver queries root, TLD and authoritative servers. It opens a TCP connection with SYN, SYN-ACK, ACK, then does a TLS 1.3 handshake in one round trip using ECDHE, verifies the certificate chain, and sends the HTTP GET.',
        scores: criteria(33, 18, 15, 17),
        correctConcepts: ['DNS resolution', 'TCP handshake', 'TLS 1.3 handshake', 'HTTP request'],
        missingConcepts: ['HTTP/3 over QUIC'],
        feedback: 'Clear, correctly ordered trace. Mention QUIC to show awareness of modern transports.',
        improvedAnswer: 'Close by noting that HTTP/3 runs over QUIC (UDP), merging the transport and TLS handshakes.',
        timeSpentSeconds: 260,
      },
    ],
  },
  {
    daysAgo: 1,
    title: 'Medium Technical Interview · Software Development Engineer',
    difficulty: 'Medium',
    topics: ['Database Management Systems', 'System Design'],
    durationMinutes: 25,
    minutesUsed: 18,
    summary: { attentionPct: 95.8, facePresentPct: 99.6, multiplePeoplePct: 0, speakingPct: 5.2, phoneDetections: 0 },
    events: [],
    items: [
      {
        topic: 'Database Management Systems',
        difficulty: 'Medium',
        questionText: 'Explain how indexing improves read performance, and discuss the trade-offs on writes.',
        referenceConcepts: ['B+ tree', 'O(log N) lookup', 'Write overhead', 'Disk I/O reduction'],
        evaluationCriteria: ['Explains B+ tree structure', 'Highlights disk I/O reduction', 'Analyzes write overhead'],
        responseText:
          'Indexes are usually B+ trees. Instead of a full table scan that reads every page, the engine walks root, internal and leaf nodes in O(log N) page reads. The trade-off is that every insert, update or delete on an indexed column also has to update the tree, which costs write latency and storage.',
        scores: criteria(36, 18, 17, 17),
        correctConcepts: ['B+ tree', 'O(log N) lookup', 'Write overhead', 'Disk I/O reduction'],
        missingConcepts: ['Clustered vs secondary indexes'],
        feedback: 'Excellent answer with correct complexity and practical trade-offs.',
        improvedAnswer: 'Distinguish clustered indexes (rows stored in key order) from secondary indexes (extra lookup to the row).',
        timeSpentSeconds: 150,
      },
      {
        topic: 'System Design',
        difficulty: 'Medium',
        questionText: 'How would you add a Redis cache to a high-traffic service, and how would you handle invalidation?',
        referenceConcepts: ['Cache-aside', 'TTL / eviction', 'Cache stampede', 'Event-driven invalidation'],
        evaluationCriteria: ['Identifies caching patterns', 'Discusses invalidation', 'Mentions consistency trade-offs'],
        responseText:
          'I would use cache-aside: read Redis first, on a miss read the database, populate Redis with a TTL and return. On writes, update the database and delete the key, or publish an event so other instances drop their copies.',
        scores: criteria(32, 16, 16, 16),
        correctConcepts: ['Cache-aside', 'TTL / eviction', 'Event-driven invalidation'],
        missingConcepts: ['Cache stampede protection'],
        feedback: 'Good architecture. Cover stampedes on hot keys with request coalescing or a short lock.',
        improvedAnswer: 'Add jittered TTLs and a single-flight lock on misses for hot keys to avoid stampedes.',
        timeSpentSeconds: 165,
      },
    ],
  },
];

const seedSessionsFor = async (user) => {
  const existing = await Interview.countDocuments({ userId: user._id });
  if (existing > 0) return;

  for (const spec of SAMPLE_SESSIONS) {
    const startedAt = new Date(Date.now() - spec.daysAgo * DAY - 2 * HOUR);
    const completedAt = new Date(startedAt.getTime() + spec.minutesUsed * 60_000);
    const scores = spec.items.map((it) => total(it.scores));
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    const interview = await Interview.create({
      userId: user._id,
      title: spec.title,
      targetRole: user.targetRole,
      difficulty: spec.difficulty,
      interviewType: 'Technical',
      topics: spec.topics,
      status: 'completed',
      endReason: 'all_answered',
      durationMinutes: spec.durationMinutes,
      currentQuestionIndex: spec.items.length,
      overallScore,
      proctoringViolations: spec.events.length,
      proctoringSummary: {
        engine: 'mediapipe',
        calibrated: true,
        framesAnalyzed: spec.minutesUsed * 60 * 12,
        monitoredSeconds: spec.minutesUsed * 60,
        ...spec.summary,
      },
      startedAt,
      completedAt,
      isFallbackAI: true,
      aiProvider: 'fallback',
    });

    const questions = await Question.insertMany(
      spec.items.map((it, idx) => ({
        interviewId: interview._id,
        orderIndex: idx,
        questionText: it.questionText,
        topic: it.topic,
        difficulty: it.difficulty,
        type: 'Technical',
        referenceConcepts: it.referenceConcepts,
        evaluationCriteria: it.evaluationCriteria,
      }))
    );
    interview.questions = questions.map((q) => q._id);
    await interview.save();

    await Answer.insertMany(
      spec.items.map((it, idx) => ({
        interviewId: interview._id,
        questionId: questions[idx]._id,
        userId: user._id,
        responseType: 'text',
        responseText: it.responseText,
        overallScore: total(it.scores),
        criteriaScores: it.scores,
        correctConcepts: it.correctConcepts,
        missingConcepts: it.missingConcepts,
        mistakes: [],
        explanation: `Covered ${it.correctConcepts.length} of ${it.referenceConcepts.length} expected concepts.`,
        feedback: it.feedback,
        improvedAnswer: it.improvedAnswer,
        recommendedTopics: [it.topic],
        timeSpentSeconds: it.timeSpentSeconds,
        isFallbackEvaluation: true,
        submittedAt: new Date(startedAt.getTime() + (idx + 1) * it.timeSpentSeconds * 1000),
      }))
    );

    if (spec.events.length) {
      await MonitoringEvent.insertMany(
        spec.events.map((e, idx) => ({
          interviewId: interview._id,
          userId: user._id,
          eventType: e.eventType,
          severity: 'warning',
          countedAsWarning: true,
          confidence: 0.9,
          description: e.description,
          metadata: e.metadata,
          timestamp: new Date(startedAt.getTime() + (idx + 4) * 60_000),
        }))
      );
    }
  }
};

export const seedDemoUsers = async () => {
  try {
    for (const account of DEMO_ACCOUNTS) {
      let user = await User.findOne({ email: account.email });
      if (!user) {
        user = await User.create({ ...account, passwordHash: DEMO_PASSWORD });
        console.log(`[SEED] Demo account ready: ${account.email} / ${DEMO_PASSWORD}`);
      }
      await seedSessionsFor(user);
    }
  } catch (error) {
    console.warn(`[SEED] Demo data warning: ${error.message}`);
  }
};
