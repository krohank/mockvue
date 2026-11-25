# Project status

Local functional audit completed on 24 November 2026.

Implemented: local speech transcription, editable voice answers, autosaved drafts,
server-owned session timing, sequential and idempotent answer submission,
practice/assessment modes, persistent local storage, authenticated report access,
history, analytics, and report download.

Validation includes isolated regression tests, microphone lifecycle tests, actual
WAV and Opus/WebM transcription, silence handling, a production client build, and
browser checks of the interview workflow.

Hosted AI adapters and provider-key requirements have been removed. Local AI
uses LM Studio or Ollama on loopback, with structured output and provider-aware
feedback. Question-bank practice remains available when the local model is
unavailable. Speech transcription remains local and key-free.

Core question and answer logic was revised on 24 November 2026:
- 139 curated questions with worked answers and follow-ups; exact difficulty,
  balanced topic selection, recent-question avoidance, strict HR/Behavioral types.
- Answers save before grading. Durable jobs recover after interruption; slow
  feedback does not block progression or completion.
- Guided practice has no correctness grade. Results, history and analytics
  distinguish pending, ungraded and model-graded answers. Legacy keyword scores
  are excluded from current score metrics.
- Reference answers remain private until submission/session completion. Completed
  reports include study answers for skipped and unanswered questions too.

Update 25 November 2026: answer scoring no longer depends on a language model.
`AI_PROVIDER=rules` is the default. A local rubric checker (server/src/services/ai/
LocalRubricGrader.js) turns each question's saved answer and reference concepts
into a rubric and scores every answer, including HR and Behavioral ones. The
results page, history and analytics now count these scores (the client previously
recognised only model-graded answers), and answers saved without a score are
re-scored at server start. Two questions whose hand-written rubric crashed the
old rule grader are scored. Calibration: server/tests/localRubric.test.js.

The existing 9B model was briefly loaded, but multiple load attempts failed to
allocate cache memory and no live grading response completed. A native load with
an explicit smaller context also failed. Live calibration remains unverified.
The model is currently unloaded. No new model was downloaded: the system drive
had about 1 GB free at the final check. Guided review and local Whisper remain
available without keys. See README.md and logs for reproducible checks.

No claim of production readiness or zero defects is made; see QUALITY_BACKLOG.md.

Final verification for this revision: 53 isolated server tests, eight client
lifecycle/API tests and two local speech tests passed. The client production
build and git diff whitespace check passed. Browser QA exercised role-specific
topic defaults, audio upload and local transcription, two saved answers,
progression, early completion, unanswered study answers, the results report and
analytics without fabricated grades. Screenshot: logs/verified-answer-review.jpg.
