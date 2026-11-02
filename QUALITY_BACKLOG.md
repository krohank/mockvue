# Quality backlog

Severity: **P0** critical (security, data loss, blocks core flow) · **P1** major · **P2** moderate · **P3** cosmetic.

## Fixed in 2.0.0

| ID | Sev | Problem | Fix |
| --- | --- | --- | --- |
| Q-01 | P0 | Auth middleware accepted **expired** tokens and **auto-created accounts** (with a fixed known password) for any token whose user was missing; the JWT secret had a committed default, so anyone could mint tokens. | Strict verification, no account creation, tokens carry only the user id, `JWT_SECRET` required in production, 7-day expiry. |
| Q-02 | P0 | `GET /interviews/:id/report` exposed reference concepts and grading criteria **during** an active interview. | Report returns 409 until the interview ends. |
| Q-03 | P0 | Proctoring timers advanced by 0.15 "s" per animation frame (~60 fps), so the "10 s absence" rule fired after ~1 s and "4 s gaze" after ~0.4 s — candidates were terminated by false warnings. | Rules engine measures wall-clock time; tested at 16 ms and 200 ms frame intervals. |
| Q-04 | P0 | "Face detection" was a skin-colour heuristic (walls/wood counted as faces, darker skin often missed); gaze was the darkest pixel in a band; multiple faces could never be detected. | MediaPipe Face Landmarker (478 landmarks, blendshapes, head pose) + EfficientDet object detector, per-user calibration. |
| Q-05 | P1 | Dictating an answer sent `responseType: 'audio_transcript'`, which the schema rejected → answer submission failed. | Client sends `voice`/`mixed`/`text`; schema accepts them. |
| Q-06 | P1 | Dictation appended every interim result, duplicating text many times over. | Final phrases appended once; interim text shown separately. |
| Q-07 | P1 | Ending early or being terminated averaged only answered questions, inflating scores (1 good answer of 5 → 90 %). | Mean over all questions; unanswered = 0. |
| Q-08 | P1 | No server-side time limit; the timer lived in `localStorage` and reset on another device. | Server deadline + grace; countdown corrected for clock skew; overdue sessions closed automatically. |
| Q-09 | P1 | Answers accepted for terminated interviews; termination via warnings left `overallScore` null. | Status machine checks; single `finalizeInterview` used by every path, with atomic transitions. |
| Q-10 | P1 | Offline evaluator gave ≥ 25 to anything over 15 characters; any word matching gave concept credit. | Rewritten evaluator with quality gates, stemming, acronym matching, STAR scoring; no floor. |
| Q-11 | P1 | Six of the 13 topics offered in the UI had no offline questions. | Bank expanded to 51 questions covering every topic at every difficulty; interview type respected. |
| Q-12 | P1 | LLM scores were stored unvalidated (out-of-range values caused 500s). | `normalizeEvaluation` clamps and recomputes totals. |
| Q-13 | P1 | Room could get stuck behind the full-screen gate on browsers without the Fullscreen API (iPhone). | Full-screen rule disabled where unsupported. |
| Q-14 | P1 | A single window blur (e.g. a notification) ended the interview. | Brief blur = warning; > 1.5 s away = termination. |
| Q-15 | P2 | Overlay canvas was 320×240 stretched over a 16:9 box, misaligned with the cropped video. | Canvas matches the video's intrinsic size, object-fit and mirroring. |
| Q-16 | P2 | The whole room re-rendered at 60 fps from CV telemetry. | Vision state throttled to ~6 Hz; rules run outside React state. |
| Q-17 | P2 | `<button>` nested inside `<a>` throughout; missing focus states; 10–11 px text; fake statistics on the landing page. | Polymorphic `Button`, visible focus, ≥ 12 px text, honest copy. |
| Q-18 | P2 | Gemini API key sent in the URL; no request aborts on timeout. | Header auth; `AbortController` timeouts. |
| Q-19 | P2 | Mac users could copy/paste freely (only Ctrl was intercepted); paste via menus wasn't blocked. | Meta key handled; clipboard events blocked at document level. |
| Q-20 | P3 | Docs claimed "production-ready, zero known bugs". | Honest status in `PROJECT_STATUS.md`. |

## Open

| ID | Sev | Item |
| --- | --- | --- |
| B-01 | P2 | Run vision inference in a Web Worker (OffscreenCanvas) to free the main thread further on low-end laptops. |
| B-02 | P2 | Email verification and password reset flows. |
| B-03 | P3 | Optional Anthropic/Claude provider alongside Gemini and OpenAI. |
