# MockVue

**Mock technical and HR interviews with rubric scoring, model answers, and on-device computer-vision proctoring.**

MockVue lets candidates (campus placements, SDE/frontend/backend/data roles) practice timed interviews by typing or speaking.
Every answer is scored out of 100 on a four-part rubric, compared against reference concepts, and paired with a model answer.
Sessions run in full-screen and are proctored by MediaPipe face-landmark and object-detection models that run **entirely in the
browser** — no video, images, or audio ever leave the device.

---

## Features

| Area | What you get |
| --- | --- |
| **Interviews** | 8 roles · 13 topics · Easy/Medium/Hard · Technical, Mixed, Behavioral (STAR) or HR · 1–10 questions · 5–90 min |
| **Answering** | Typed answers or speech-to-text dictation (Web Speech API), autosaved drafts, question navigator, skip & return |
| **Scoring** | Technical correctness 40 · Relevance 20 · Completeness 20 · Clarity 20 — with covered/missed concepts, gaps, feedback and a model answer |
| **AI providers** | Google Gemini or OpenAI for semantic grading; an offline question bank + rubric evaluator when no key is configured |
| **Computer vision** | Face presence, multiple faces, head pose, eye gaze (calibrated per user), phone detection, extra people, voice while silent |
| **Exam rules** | Full-screen lock, tab/app switching, copy/paste/devtools blocking, 5-warning limit, server-side time limit |
| **Reports** | Score ring, rubric breakdown, per-question review, proctoring summary & timeline, print/PDF |
| **Progress** | Score trend, topic and criterion averages, difficulty breakdown, streaks, recommendations |
| **UX** | Light/dark/system theme, responsive down to 360px, keyboard accessible, reduced-motion support |

---

## Quick start

Requirements: **Node.js 20.6+**. MongoDB is optional in development (an in-memory instance starts automatically).

```bash
npm run install:all
```

```bash
cp server/.env.example server/.env
```

```bash
npm run dev
```

- App: http://localhost:5173 · API: http://localhost:5000/api/health
- Demo accounts (seeded outside production): `candidate@mockvue.edu` / `password123` and `megenta.point@gmail.com` / `password123`.
  The sign-in page offers them as one-click buttons when the server has seeded them.

`npm install` in `client/` also self-hosts the computer-vision runtime (copies MediaPipe WASM, downloads ~8 MB of models into
`client/public/`). If that download fails, the app loads the same files from the public CDN at runtime.

> The camera only works on `https://` or `http://localhost`.

---

## Architecture

```text
┌────────────────────────────── Browser ───────────────────────────────┐
│ React 18 · Vite · Tailwind (token-based light/dark) · Recharts        │
│                                                                       │
│  Interview room                                                       │
│   camera ─► ProctoringEngine ── FaceLandmarker (478 pts, blendshapes, │
│   mic   ─►   (on-device)     │   head-pose matrix)       ~5–15 fps    │
│              │               └─ ObjectDetector (phone, person) ~1 fps │
│              ▼                                                        │
│        ProctoringRules (time-based, cooldowns, calibration baseline)  │
│              │ violations (JSON only)          useExamLockdown        │
│              ▼                                  (full-screen, tabs,    │
└──────────────┼──────────────────────────────── clipboard, devtools) ──┘
               │ HTTPS · JWT
┌──────────────▼──────────────────── Express API ──────────────────────┐
│ auth · interviews (state machine, deadlines) · monitoring · analytics│
│ AIServiceManager ── Gemini │ OpenAI │ offline bank + rubric evaluator │
└──────────────┬────────────────────────────────────────────────────────┘
               ▼
           MongoDB (Users, Interviews, Questions, Answers, MonitoringEvents)
```

### Interview lifecycle

`created` → `in_progress` (timer starts when the candidate enters full-screen) → `completed` | `terminated` (proctoring) |
`abandoned` (never started). The server owns the clock: answers after the deadline (+60 s grace) are rejected and overdue
sessions are closed automatically. The overall score is the mean across **all** questions — unanswered questions count as zero,
so ending early never inflates a score.

---

## Computer-vision proctoring

All analysis happens in `client/src/services/cv/`:

| Module | Role |
| --- | --- |
| `visionRuntime.js` | Loads MediaPipe Tasks Vision (self-hosted first, CDN fallback). Uses the GPU only when a hardware GPU is present — on software WebGL (SwiftShader/llvmpipe) the CPU path is ~4× faster and the object detector only works on CPU. |
| `ProctoringEngine.js` | Runs face landmarks every frame (cadence adapts so inference uses ≤40 % of the main thread), objects ~1×/s, lighting ~1×/s, mic level continuously. Recovers from graph errors; degrades to basic presence detection if MediaPipe can't run. |
| `geometry.js` | Head yaw/pitch/roll from the facial transformation matrix (column-major, verified on real faces), gaze from eye blendshapes, framing hints, attention classification. |
| `proctoringRules.js` | Pure, unit-tested rules engine using wall-clock time. |
| `policy.js` | Every threshold in one place. |

**Rules** (defaults in `policy.js`):

| Condition | Must persist | Result |
| --- | --- | --- |
| No face in view | 10 s | warning |
| More than one face / another person detected | 2 s / 2.5 s | warning |
| Phone in view | 1.5 s | warning |
| Head or eyes turned away (relative to calibration) | 5 s | warning |
| Voice-level audio while the candidate's mouth isn't moving | 6 s | warning |
| Brief focus loss · blocked shortcut · paste · right-click | — | warning |
| Leaving full-screen · switching tabs · switching apps (> 1.5 s) | — | ends interview |
| 5th warning | — | ends interview |

**Fairness safeguards:** a 4 s start grace, a 15 s cool-down per rule, a 4 s minimum gap between warnings, looking down at the
keyboard while typing is allowed, blinks don't count as looking away, and a 3-second calibration learns each person's neutral
head pose so an off-centre webcam doesn't count against them. The server — not the client — decides which events are warnings
or critical.

**Privacy:** frames are analysed in memory and discarded. Only event types, timestamps, a few numbers (e.g. head angle, face count)
and a session summary (% time present / attentive) are sent. Proctoring signals are indicators for practice, not proof of misconduct.

---

## Configuration

`server/.env` (see `server/.env.example`):

| Variable | Default | Notes |
| --- | --- | --- |
| `JWT_SECRET` | dev-only value | **Required in production** (16+ chars); the server refuses to start without it. |
| `JWT_EXPIRES_IN` | `7d` | |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/mockvue` | |
| `ALLOW_IN_MEMORY_DB` | `true` (non-prod) | Falls back to `mongodb-memory-server` when MongoDB is unreachable. |
| `SEED_DEMO_DATA` | `true` (non-prod) | Demo accounts with sample sessions. |
| `AI_PROVIDER` | `fallback` | `gemini` or `openai` (needs `AI_API_KEY`). |
| `AI_MODEL` | provider default | `gemini-2.5-flash` / `gpt-4o-mini`. |
| `AI_TIMEOUT_MS` | `20000` | Requests are aborted and fall back to the offline evaluator. |
| `SERVE_CLIENT` | `true` in prod | Serves `client/dist` with a strict Content-Security-Policy. |
| `TRUST_PROXY` | `false` | Set behind a reverse proxy so rate limits see real client IPs. |

---

## Testing

```bash
npm test
```

Runs 49 unit tests (no database needed):

- **Server** (`server/tests/unit`): offline evaluator calibration (strong ≫ partial ≫ short; gibberish, repetition and off-topic
  answers score low; STAR scoring), LLM output normalisation, JSON repair, question selection per topic/type, provider fallback,
  score aggregation, deadlines, proctoring-summary sanitisation, event severities, JWT payloads.
- **Client** (`client/src/services/cv/cv.test.js`): head-pose maths, gaze, framing, attention classification with calibration,
  rules timing at 16 ms and 200 ms frame intervals, cooldowns, grace period, audio dBFS, presence fallback.

```bash
npm run test:e2e
```

Full API flow against a real MongoDB (in-memory by default, or set `MONGODB_URI`): auth and token expiry, sanitised questions,
report gating, scoring, warning limits, critical events, server-side time limit, ownership checks.

---

## Production

```bash
npm run build
```

```bash
NODE_ENV=production JWT_SECRET=<long-random> MONGODB_URI=<uri> npm start
```

Express serves the API and the built client from one process. Put it behind HTTPS (required for camera access).

---

## API

All routes except auth and health need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Status, DB state, AI provider |
| POST | `/api/auth/register` · `/api/auth/login` | Rate-limited; returns a JWT |
| GET | `/api/auth/me` | Current user |
| GET/PUT | `/api/users/profile` | Profile |
| PUT | `/api/users/password` | Change password |
| POST | `/api/interviews/generate` | Create an interview |
| GET | `/api/interviews/history` | List with answered counts |
| GET / DELETE | `/api/interviews/:id` | Session (reference keys hidden until it ends) / delete with all data |
| POST | `/api/interviews/:id/start` | Start the timer; returns `deadline` and `serverTime` |
| POST | `/api/interviews/:id/answer` | Submit and evaluate an answer |
| POST | `/api/interviews/:id/complete` | Finish (optionally with a proctoring summary) |
| GET | `/api/interviews/:id/report` | Full report (409 until the interview ends) |
| POST/GET | `/api/interviews/:id/monitoring` | Log / list proctoring events |
| GET | `/api/analytics/overview` · `/api/analytics/performance` | Dashboard and progress data |

---

## Project structure

```text
client/
  scripts/setup-vision-assets.mjs   self-hosts MediaPipe WASM + models
  src/components/{ui,layout,charts,proctoring}
  src/hooks/        useCamera, useVisionEngine, useDictation, useExamLockdown, useCountdown …
  src/services/cv/  vision engine, geometry, rules, policy, audio (+ tests)
  src/pages/        Landing, Auth, Dashboard, Create, Prep, Room, Results, Analytics, History, Profile
server/
  src/config/       env, db, constants
  src/controllers/  auth, user, interview, analytics/monitoring
  src/services/     interviewLifecycle, ai/ (providers, prompts, evaluator, question bank)
  tests/unit, tests/e2e
```

---

## Viva notes

**Why an adapter for AI providers?** Controllers depend only on `AIServiceManager`. Any provider error, timeout, malformed JSON or
out-of-range score falls back to the offline bank/evaluator, and every evaluation is normalised (scores clamped, total recomputed)
before it reaches the database.

**How is cheating limited?** Reference concepts and grading criteria never leave the server until the interview ends (the report
endpoint is gated too). The server enforces the time limit, decides event severity, and counts warnings atomically.

**Why on-device computer vision?** Streaming video to a server costs bandwidth, adds latency and creates a privacy liability. WASM
inference keeps raw frames on the candidate's machine; only small JSON events are sent.

**Why can't the old timer drift?** The countdown is computed from the server's `deadline` and corrected for client clock skew via
`serverTime`, so reloads, background tabs and device changes don't affect it.

**What if the offline evaluator is gamed?** It measures concept coverage, overlap with the question, structure and depth, and
applies quality gates for short, repetitive or non-word text — there is no minimum score. It is honest about its limits: reports say
when the offline engine was used and suggest configuring an AI provider for semantic grading.
