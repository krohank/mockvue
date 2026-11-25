# Quality audit

## Fixed and covered by regression checks

- Replaced browser-only dictation with local Whisper transcription, recording
  state, microphone level, audio upload, retry, language selection, and editable
  transcripts. Partial transcripts are no longer appended repeatedly.
- Voice answers use the server's accepted voice format.
- Account-scoped drafts survive refresh and sync to the server. Checkpoints
  made before the deadline survive browser suspension. Unsubmitted device
  drafts are recoverable in reports without changing scores. Resume uses the server's next unanswered
  question and original deadline.
- The timer begins on explicit start. Start and submit retries are idempotent.
- Concurrent submissions cannot advance the same interview twice.
- Closed and unstarted sessions reject new answers.
- Active reports no longer expose reference answers.
- Skipped and unanswered questions contribute zero only to fully model-graded session totals; guided sessions remain ungraded. Rubric totals are normalized.
- Every topic in setup has bank coverage. Unrelated topics are not silently
  substituted, and insufficient counts are disclosed.
- Normal practice no longer ends on blur, camera heuristics, or permission dialogs.
- Expired tokens are rejected. Missing users are not silently recreated with a
  known password. Wrong sign-ins do not create accounts.
- Local data survives backend restarts. Existing local records were preserved.
- History links handle terminated sessions. Average-score zero and actual
  practice-duration calculations are fixed.
- Added accessible form labels, keyboard-operable setup choices, reduced-motion
  support, page error recovery, and report download.

- Expanded the catalogue to 139 distinct questions with worked answers, follow-ups,
  precise difficulty filtering, balanced topics and recent-question avoidance.
- Corrected misleading two-pointer, Java HashMap, deadlock, paging and distributed
  consistency reference material. HR answers ask for truthful examples.
- Persisted answers before asynchronous grading. Slow and interrupted grading,
  duplicate retries and crashes between answer save and progress update are covered.
- Removed fabricated keyword grades from results and analytics, including old
  keyword scores. Unknown-source historical grades are not used as new AI evidence.
- Separated curated study answers from model-generated answers; grounded local
  grading in references and added strict numeric and feedback validation.
- Readiness checks use loaded LM Studio instances, not a list of downloaded files.

## Practical limits

- Scoring is a local rubric overlap estimate (no LLM). It cannot establish correctness:
  valid answers in unfamiliar vocabulary can be under-scored and unknown false
  statements missed. Behavioral scores check story structure only. Independently
  marked human answers are still needed to calibrate the thresholds.

- AI no longer requires hosted provider keys. Local model feedback requires
  a running LM Studio or Ollama model with enough memory. Until that model is
  available, practice uses worked solutions and a reference-term checklist without correctness scores.
- The local AI transport, output validation, refusal of hosted addresses and
  per-request fallback have automated tests. Actual local-model grading quality
  is not verified: the current 9B model could not complete calibration under current memory constraints. Independently marked answer examples are also needed.
- Voice recordings require browser microphone permission and working hardware.
  Audio upload is available when direct recording is unsupported.
- Automated audio tests use generated speech and silence. Real-device testing
  across browsers remains necessary; these checks do not prove zero defects.
- Interview mutations are serialized within one API process. A multi-instance
  deployment would need distributed coordination and production load testing.
- Assessment focus checks run on the client and are not a tamper-proof exam system.

See README.md for reproducible checks and local setup.
