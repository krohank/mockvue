# Project status

**Version:** 2.0.0

## What works and how it was verified

| Area | Status | Verification |
| --- | --- | --- |
| Auth (register, login, JWT expiry, password change) | Done | Unit tests (JWT); E2E suite (`npm run test:e2e`) |
| Interview generation (Gemini / OpenAI / offline bank, 13 topics × 3 tiers) | Done | Unit tests for selection, provider fallback, JSON repair |
| Answer evaluation (LLM normalisation, offline rubric evaluator) | Done | Unit tests calibrating strong vs weak vs gibberish answers |
| Interview lifecycle (server deadline, scoring incl. unanswered, report gating) | Done | Unit + E2E tests |
| On-device computer vision (MediaPipe face landmarks + object detection) | Done | Run in headless Chromium against a real portrait: 1 face / 2 faces / empty frame detected correctly; head-pose matrix layout verified; calibration verified |
| Proctoring rules (timing, cooldowns, calibration, warnings, termination) | Done | 23 client unit tests; browser run confirmed multi-face warning, paste block, tab-switch termination, 10 s absence warning |
| UI (all pages, light/dark, mobile) | Done | Full candidate journey driven in Chromium with a fake webcam; screenshots reviewed |
| Production serving (Express + built client, CSP) | Done | Verified headers, SPA fallback, static model/WASM serving |

## Known limitations

- The E2E API suite needs a MongoDB binary (downloaded by `mongodb-memory-server` on first run, or set `MONGODB_URI`). It could
  not be executed in the build environment used for this release; the unit suites and the browser flow (against an in-memory API
  that reuses the server's evaluator and scoring) were.
- Phone detection uses the COCO "cell phone" class of EfficientDet-Lite0; small or partially hidden phones may be missed.
- Gaze is estimated from blendshapes and head pose, not eye tracking hardware; calibration reduces but does not remove error.
- Dictation depends on the browser's Web Speech API (Chrome/Edge/Safari; not Firefox).
- Full-screen is unavailable on iPhone Safari; the interview runs without the full-screen rule there.
- The offline evaluator measures coverage and structure; it cannot verify factual correctness the way an LLM can.
