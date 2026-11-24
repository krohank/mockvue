# MockVue

Technical interview practice with typed and voice answers, saved drafts, interview history, and feedback.

## Project report

[Download the major project report](docs/MockVue%20Major%20Project%20Report.docx).
It includes the current architecture, application screenshots, source excerpts,
verification results, and known limitations.

## Run locally

Requires Node.js 18+ and Python 3.10+ for local speech transcription.

    npm run install:all
    python -m pip install -r server/speech/requirements.txt

Copy server/.env.example to server/.env and client/.env.example to client/.env.
Set a unique JWT_SECRET in server/.env, then run:

    npm run dev

- App: http://localhost:5173
- API health: http://localhost:5000/api/health

The first speech-service start downloads the Whisper model if it is not cached.
WHISPER_MODEL defaults to base; PYTHON_BIN defaults to python.
Recordings can also be uploaded as WAV, MP3, MP4, or WebM. Recordings are limited
to 15 MB and five minutes. Audio is transcribed on the local server and temporary
uploads are removed after processing. No third-party speech API is required.

## Data

The server uses MONGODB_URI when available. In development, it can launch a
local MongoDB instance with persistent storage under .local-data/mongodb.
That directory, environment files, and logs are ignored by Git.
Drafts save on the device and sync to the server during an active interview.
Server checkpoints made before the deadline can be recovered for review after browser suspension.
Unsubmitted device drafts are recoverable in the report without changing scores.

## Interview modes

- Practice: camera preview and full screen are optional. Tab changes do not end
  the session. The timer starts when Start interview is clicked.
- Assessment: full screen is required; leaving full screen or switching tabs
  ends the session. Browser permission dialogs are exempted. Camera previews
  are never scored, and no skin-tone or gaze heuristics are used.

The server owns start times, deadlines, answer order, and completion. Submitted
answers are immutable; request retries return the saved answer. Unanswered and
skipped questions contribute zero to a fully model-graded interview score. A session containing guided, ungraded answers has no overall correctness score. Practice
allows up to two minutes for an in-flight transcript or request to finish after
the timer reaches zero; assessment has a two-second network grace period.

## AI feedback without API keys

MockVue uses local models or its built-in question bank. There are no hosted
LLM adapters, provider keys, accounts, quotas, or per-request API charges.
Speech also runs locally. Hardware, electricity, internet downloads and any
optional hosting still have their normal costs.

For local model feedback, install [LM Studio 0.4 or later](https://lmstudio.ai/) and download
a model that fits your machine. If a model is already downloaded, reuse it.
Load it under the `mockvue-local` identifier, then start the loopback server:

    lms ls
    lms load <your-model-key> --identifier mockvue-local --context-length 8192 --parallel 1 --ttl 1800
    npm run ai:start
    npm run ai:status

Free sufficient RAM and GPU memory before loading. Model names are listed by
`lms ls`; `<your-model-key>` is a placeholder, not a literal command argument.
The model file and LM Studio runtime must both be installed for offline use.
MockVue never downloads or loads a model automatically during an interview.

The default server settings are:

    AI_PROVIDER=local
    LOCAL_AI_BACKEND=lmstudio
    LOCAL_AI_URL=http://127.0.0.1:1234
    LOCAL_AI_MODEL=mockvue-local
    LOCAL_AI_TIMEOUT_MS=60000

The endpoint uses an OpenAI-compatible request format, but all inference is
sent to the local LM Studio process. It does not contact OpenAI. Requests have
no authorization header, use structured JSON output, validate topic/count and
rubric values, and reject hosted endpoints and HTTP redirects.

[Ollama](https://docs.ollama.com/) is also supported. After installing it and
pulling a suitable local model, such as `ollama pull qwen3:4b`, set:

    LOCAL_AI_BACKEND=ollama
    LOCAL_AI_URL=http://127.0.0.1:11434
    LOCAL_AI_MODEL=qwen3:4b

For Ollama, set `OLLAMA_NO_CLOUD=1` in the environment that starts `ollama serve`
to disable cloud features. Cloud-tagged model names are rejected by MockVue.

If the local model is stopped, missing, too slow or returns invalid output,
practice continues with a worked answer and a reference-term checklist, without
assigning a correctness score. Set `AI_PROVIDER=fallback` for this mode alone.
It needs no LLM installation. Mentioned terms can be wrong and valid paraphrases
can be missed; checklist coverage is never used as a grade or readiness metric.

The curated catalogue has 139 distinct questions, worked study answers and
follow-ups across 13 topics. Questions retain the exact requested difficulty.
Selection balances topics and avoids questions from the last five sessions when
the pool permits. HR and Behavioral stay separate. Smaller pools and topic
coverage limits are disclosed instead of silently substituting difficulty or
unrelated topics. Role choices set relevant topic defaults; explicitly chosen
topics control the final bank selection. Catalogue questions are preferred;
local question generation is attempted only when the bank cannot fill a request.
Model-generated study answers are labeled separately from curated ones.

Answers are persisted before grading. A single worker claims durable database
jobs, retries interrupted leases and records the actual feedback provider.
Candidates can continue while feedback is pending. Results update automatically;
slow or invalid model output falls back to an ungraded study review. Curated
answers ground the grader and remain the displayed study solution. Historical
keyword scores and unknown-source scores are excluded from current score metrics.
 Saved answers record their actual feedback provider independently
of the question source. Local model feedback can also be wrong and has not
been validated against an independently marked student-answer dataset.

## Verification

    npm test
    npm run build:client

The regression suite uses an isolated temporary database, not local user data.
It covers authentication, expired tokens, ownership, report privacy, deadlines,
answer ordering, concurrent submissions, resume, skipping, completion, topic
coverage, score validation, and microphone resource cleanup.

Optional local speech smoke tests (requires Python speech dependencies):

    npm run test:speech --prefix server

For the speech-fixture test, set MOCKVUE_SPEECH_FIXTURE to a recording containing
the word "hash", or place it at .local-data/speech-test.wav. A silence test runs
as well. The older running-server flow can be run with:

    npm run test:legacy --prefix server

Microphone permission and hardware behavior should be checked in the intended
browser. Local AI protocol tests mock model responses; they do not establish
the quality of a downloaded model. Check `npm run ai:status` and exercise actual
question generation and feedback before reporting a local model as verified.


Optional live model calibration (requires a loaded `mockvue-local` LM Studio model):

    node server/scripts/audit-local-ai.mjs

This compares worked answers and paraphrases with incorrect reasoning, keyword
lists, unrelated text and instructions asking for full marks. Inspect the saved
feedback, not just the totals. It is a small smoke check, not an independent
benchmark. The 9B model on this machine has not completed this calibration:
loads encountered cache-allocation failures and a brief successful load did not
produce a completed grading response. No new model was downloaded because the
system drive had about 1 GB free at the final check. Guided practice and local
speech transcription are verified; local grading quality remains unverified.

Technical reference points used while correcting the catalogue include
[OpenJDK HashMap](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/HashMap.java),
[PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html),
[Spring transaction proxies](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)
and [Python threading](https://docs.python.org/3/library/threading.html).
