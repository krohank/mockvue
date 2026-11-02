import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Keyboard,
  Loader2,
  Maximize,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  SkipForward,
  Video,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks/useAsync';
import { useCamera, useVideoStream } from '../hooks/useCamera';
import { useElementRef } from '../hooks/useElementRef';
import { useVisionEngine } from '../hooks/useVisionEngine';
import { useDictation } from '../hooks/useDictation';
import { useCountdown } from '../hooks/useCountdown';
import { useExamLockdown, enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen } from '../hooks/useExamLockdown';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert, ErrorState, PageLoader } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Dialog';
import { ScoreRing, Meter } from '../components/ui/Metrics';
import { LogoMark } from '../components/layout/Logo';
import { CameraView, VisionReadout } from '../components/proctoring/CameraPanel';
import { ProctoringRules } from '../services/cv/proctoringRules';
import { PROCTORING_POLICY } from '../services/cv/policy';
import { loadProctoringSetup, clearProctoringSetup } from '../services/proctoringSession';
import { session, KEYS } from '../lib/storage';
import { RUBRIC, TOPIC_SHORT, MAX_ANSWER_LENGTH } from '../lib/constants';
import { formatClock, wordCount, pluralize } from '../lib/format';
import api from '../services/api';

const MAX_WARNINGS = PROCTORING_POLICY.maxWarnings;

const RULE_LABELS = {
  absent: 'No face in view',
  multipleFaces: 'More than one face',
  extraPerson: 'Another person detected',
  phone: 'Phone in view',
  lookAway: 'Looking away',
  voiceWhileSilent: 'Voices while you’re silent',
};

let beepCtx = null;
const beep = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    beepCtx = beepCtx || new Ctx();
    const osc = beepCtx.createOscillator();
    const gain = beepCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, beepCtx.currentTime);
    gain.gain.setValueAtTime(0.12, beepCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, beepCtx.currentTime + 0.25);
    osc.connect(gain).connect(beepCtx.destination);
    osc.start();
    osc.stop(beepCtx.currentTime + 0.25);
  } catch {
    /* audio is a nicety */
  }
};

const WarningPips = ({ count }) => (
  <div className="flex items-center gap-1.5" role="img" aria-label={`${count} of ${MAX_WARNINGS} warnings used`}>
    {Array.from({ length: MAX_WARNINGS }, (_, i) => (
      <span
        key={i}
        className={`h-2.5 w-2.5 rounded-full border ${i < count ? (count >= MAX_WARNINGS - 1 ? 'border-danger bg-danger' : 'border-warning bg-warning') : 'border-line-strong bg-transparent'}`}
      />
    ))}
  </div>
);

const FeedbackPanel = ({ evaluation, onNext, nextLabel, isLast }) => (
  <div className="card p-5 animate-slide-up sm:p-6" aria-live="polite">
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <ScoreRing score={evaluation.overallScore} size={120} />
      <div className="flex-1 space-y-3">
        {RUBRIC.map((r) => (
          <Meter key={r.key} label={r.label} value={evaluation.criteriaScores?.[r.key] ?? 0} max={r.max} compact />
        ))}
      </div>
    </div>
    {evaluation.feedback && (
      <div className="mt-6 rounded-xl bg-surface-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Feedback</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{evaluation.feedback}</p>
      </div>
    )}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Covered
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {(evaluation.correctConcepts?.length ? evaluation.correctConcepts : ['—']).map((c) => (
            <li key={c} className="rounded-md bg-success-soft px-2 py-0.5 text-xs text-ink-2">
              {c}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Missed
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {(evaluation.missingConcepts?.length ? evaluation.missingConcepts : ['Nothing major']).map((c) => (
            <li key={c} className="rounded-md bg-warning-soft px-2 py-0.5 text-xs text-ink-2">
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
    <p className="mt-4 text-xs text-ink-3">The model answer is in your report at the end.</p>
    <div className="mt-6 flex justify-end">
      <Button onClick={onNext} iconRight={isLast ? FileText : ArrowRight} size="lg" data-autofocus>
        {nextLabel}
      </Button>
    </div>
  </div>
);

export const InterviewRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  useDocumentTitle('Interview in progress');

  const setup = useMemo(() => loadProctoringSetup(id), [id]);
  const [cameraWanted, setCameraWanted] = useState(setup ? setup.camera !== false : true);

  const [interview, setInterview] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | gate | active | finishing | terminated
  const phaseRef = useRef('loading');
  const [timing, setTiming] = useState({ deadline: null, serverTime: null });
  const [answers, setAnswers] = useState({}); // questionId → { overallScore, evaluation? }
  const [currentId, setCurrentId] = useState(null);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [banner, setBanner] = useState(null);
  const [termination, setTermination] = useState(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [gateError, setGateError] = useState('');
  const [starting, setStarting] = useState(false);
  const [requireFs, setRequireFs] = useState(true);
  const [pending, setPending] = useState({});
  const [showLog, setShowLog] = useState(false);

  const [videoRef, videoEl] = useElementRef();
  const [canvasRef, canvasEl] = useElementRef();
  const textareaRef = useRef(null);
  const rulesRef = useRef(new ProctoringRules());
  const warningCountRef = useRef(0);
  const terminatedRef = useRef(false);
  const finishingRef = useRef(false);
  const questionStartRef = useRef(Date.now());
  const inputModeRef = useRef({ typed: false, voice: false });
  const lastPendingUiRef = useRef(0);

  const setPhaseBoth = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const camera = useCamera();
  useVideoStream(videoEl, camera.stream);

  // ── Load interview ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/interviews/${id}`)
      .then(({ interview: data }) => {
        if (cancelled) return;
        if (['completed', 'terminated', 'abandoned'].includes(data.status)) {
          navigate(`/interviews/${id}/results`, { replace: true });
          return;
        }
        setInterview(data);
        const answered = Object.fromEntries((data.answers || []).map((a) => [a.questionId, { overallScore: a.overallScore }]));
        setAnswers(answered);
        const firstOpen = data.questions.find((q) => !answered[q._id]) || data.questions[0];
        setCurrentId(firstOpen?._id || null);
        setDraft(session.get(KEYS.draft(id, firstOpen?._id), '') || '');
        if (data.deadline) setTiming({ deadline: data.deadline, serverTime: data.serverTime });
        setPhaseBoth('gate');
      })
      .catch((err) => !cancelled && setLoadError(err));
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const questions = interview?.questions || [];
  const currentIndex = questions.findIndex((q) => q._id === currentId);
  const current = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.length > 0 && answeredCount >= questions.length;

  // ── Proctoring summary & termination ─────────────────────────────────────
  const engineModeRef = useRef('none');
  const summary = () => rulesRef.current.summary(cameraWanted ? engineModeRef.current : 'none', Boolean(setup?.calibrated));

  const stopCamera = camera.stop;
  const stopDevices = useCallback(() => stopCamera(), [stopCamera]);

  const dictation = useDictation({
    onFinal: (text) => {
      inputModeRef.current.voice = true;
      setDraft((d) => {
        const next = `${d}${d && !/\s$/.test(d) ? ' ' : ''}${text}`;
        return next.slice(0, MAX_ANSWER_LENGTH);
      });
    },
  });

  // useDictation returns a fresh object each render; depend on its stable callbacks only.
  const stopDictation = dictation.stop;

  const terminate = useCallback(
    async (eventType, message, { alreadyRecorded = false } = {}) => {
      if (terminatedRef.current || finishingRef.current) return;
      terminatedRef.current = true;
      setPhaseBoth('terminated');
      setTermination({ message });
      stopDictation();
      stopDevices();
      exitFullscreen();
      const proctoringSummary = summary();
      if (!alreadyRecorded) {
        try {
          await api.post(`/interviews/${id}/monitoring`, { eventType, description: message, confidence: 1 });
        } catch {
          /* still complete below */
        }
      }
      try {
        await api.post(`/interviews/${id}/complete`, { terminated: true, reason: message, proctoringSummary });
      } catch {
        /* report page will show the server state */
      }
      clearProctoringSetup(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, stopDictation, stopDevices]
  );

  const reportWarning = useCallback(
    async (eventType, message, extra = {}) => {
      if (terminatedRef.current || finishingRef.current || phaseRef.current !== 'active') return;
      warningCountRef.current += 1;
      const entry = { id: `${Date.now()}-${Math.random()}`, eventType, message, at: new Date(), count: warningCountRef.current };
      setWarnings((w) => [...w, entry]);
      setBanner(entry);
      beep();
      setTimeout(() => setBanner((b) => (b?.id === entry.id ? null : b)), 6500);

      try {
        const res = await api.post(`/interviews/${id}/monitoring`, {
          eventType,
          description: message,
          confidence: 0.9,
          durationSeconds: extra.durationSeconds,
          metadata: extra.metadata,
        });
        if (res.isTerminated) {
          terminate(eventType, res.terminationReason || message, { alreadyRecorded: true });
          return;
        }
        if (typeof res.totalWarnings === 'number' && res.totalWarnings > warningCountRef.current) {
          warningCountRef.current = res.totalWarnings;
        }
      } catch {
        /* enforce locally below */
      }
      if (warningCountRef.current >= MAX_WARNINGS) {
        terminate('max_warnings_exceeded', `You reached the limit of ${MAX_WARNINGS} proctoring warnings.`);
      }
    },
    [id, terminate]
  );

  // ── Vision → rules ────────────────────────────────────────────────────────
  const onFrame = useCallback(
    (frame) => {
      engineModeRef.current = frame.mode;
      if (phaseRef.current !== 'active' || terminatedRef.current) return;
      const violations = rulesRef.current.update(
        {
          faceCount: frame.faceCount,
          attention: frame.attention,
          persons: frame.persons,
          phone: frame.phone,
          phoneScore: frame.phoneScore,
          voice: frame.voice,
          mouthMoving: frame.mouthMoving,
          dictating: frame.dictating,
          capabilities: frame.capabilities,
        },
        frame.t
      );
      violations.forEach((v) => reportWarning(v.eventType, v.message, { metadata: v.metadata, durationSeconds: v.durationSeconds }));
      if (frame.t - lastPendingUiRef.current > 300) {
        lastPendingUiRef.current = frame.t;
        setPending(rulesRef.current.progress(frame.t));
      }
    },
    [reportWarning]
  );

  const vision = useVisionEngine({
    video: videoEl,
    canvas: canvasEl,
    stream: camera.stream,
    enabled: cameraWanted && camera.state === 'active',
    baseline: setup?.baseline || undefined,
    noiseFloorDb: setup?.noiseFloorDb ?? undefined,
    onFrame,
  });

  useEffect(() => {
    vision.engineRef.current?.setDictating(dictation.listening);
  }, [dictation.listening, vision.engineRef]);

  // Camera unplugged mid-interview: one warning per disconnect.
  const cameraLossReportedRef = useRef(false);
  useEffect(() => {
    if (camera.state === 'active') {
      cameraLossReportedRef.current = false;
    } else if (phase === 'active' && cameraWanted && camera.state === 'ended' && !cameraLossReportedRef.current) {
      cameraLossReportedRef.current = true;
      reportWarning('camera_disconnected', 'The camera stopped. Reconnect it to continue being monitored.');
    }
  }, [camera.state, phase, cameraWanted, reportWarning]);

  // ── Browser lockdown ──────────────────────────────────────────────────────
  useExamLockdown({
    active: phase === 'active',
    requireFullscreen: requireFs,
    blurGraceMs: PROCTORING_POLICY.blurGraceMs,
    onCritical: (type, message) => terminate(type, message),
    onWarning: (type, message) => reportWarning(type, message),
  });

  // ── Finish (early, all answered, or time up) ─────────────────────────────
  const submitCurrent = useCallback(
    async (text, questionId) => {
      const mode = inputModeRef.current;
      const res = await api.post(`/interviews/${id}/answer`, {
        questionId,
        responseText: text,
        responseType: mode.voice ? (mode.typed ? 'mixed' : 'voice') : 'text',
        timeSpentSeconds: Math.round((Date.now() - questionStartRef.current) / 1000),
      });
      return res;
    },
    [id]
  );

  const finish = useCallback(
    async (endReason) => {
      if (finishingRef.current || terminatedRef.current) return;
      finishingRef.current = true;
      setPhaseBoth('finishing');
      setConfirmFinish(false);
      stopDictation();
      const text = draft.trim();
      if (text && currentId && !answers[currentId]) {
        try {
          await submitCurrent(text, currentId);
        } catch {
          /* the deadline may have passed; earlier answers are safe */
        }
      }
      try {
        await api.post(`/interviews/${id}/complete`, { endReason, proctoringSummary: summary() });
      } catch {
        /* report shows server state */
      }
      questions.forEach((q) => session.remove(KEYS.draft(id, q._id)));
      clearProctoringSetup(id);
      stopDevices();
      await exitFullscreen();
      navigate(`/interviews/${id}/results`, { replace: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, draft, currentId, answers, questions, submitCurrent, stopDevices, navigate, stopDictation]
  );

  const remaining = useCountdown(timing.deadline, timing.serverTime, () => {
    if (phaseRef.current === 'active') {
      toast.warning('Time is up. Submitting your interview…');
      finish('time_expired');
    }
  });

  // ── Gate: camera → full screen → start timer ────────────────────────────
  const begin = async () => {
    setGateError('');
    setStarting(true);
    try {
      if (cameraWanted && camera.state !== 'active') {
        const stream = await camera.start();
        if (!stream) {
          setStarting(false);
          return;
        }
      }
      const fsSupported = fullscreenSupported();
      setRequireFs(fsSupported);
      if (fsSupported && !isFullscreen()) {
        const ok = await enterFullscreen();
        if (!ok) {
          setGateError('Full-screen didn’t start. Click the button again to enter full-screen.');
          setStarting(false);
          return;
        }
      }
      const res = await api.post(`/interviews/${id}/start`);
      setTiming({ deadline: res.deadline, serverTime: res.serverTime });
      rulesRef.current.reset();
      questionStartRef.current = Date.now();
      setPhaseBoth('active');
      if (!cameraWanted) {
        api.post(`/interviews/${id}/monitoring`, { eventType: 'camera_unavailable', description: 'Interview taken without camera monitoring.' }).catch(() => {});
      }
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err) {
      setGateError(err.message || 'Could not start the interview.');
      await exitFullscreen();
    } finally {
      setStarting(false);
    }
  };

  // ── Answering ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentId || phase !== 'active') return undefined;
    const t = setTimeout(() => session.set(KEYS.draft(id, currentId), draft), 400);
    return () => clearTimeout(t);
  }, [draft, currentId, id, phase]);

  const goTo = (questionId) => {
    if (questionId === currentId || submitting) return;
    if (currentId) session.set(KEYS.draft(id, currentId), draft);
    dictation.stop();
    setCurrentId(questionId);
    setFeedback(answers[questionId]?.evaluation || null);
    setDraft(session.get(KEYS.draft(id, questionId), '') || '');
    inputModeRef.current = { typed: false, voice: false };
    questionStartRef.current = Date.now();
    setTimeout(() => textareaRef.current?.focus(), 30);
  };

  const nextOpenQuestion = (fromId, answeredMap = answers) => {
    const start = questions.findIndex((q) => q._id === fromId);
    for (let i = 1; i <= questions.length; i += 1) {
      const q = questions[(start + i) % questions.length];
      if (!answeredMap[q._id]) return q._id;
    }
    return null;
  };

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || submitting || !current) return;
    dictation.stop();
    setSubmitting(true);
    try {
      const res = await submitCurrent(text, current._id);
      const nextAnswers = { ...answers, [current._id]: { overallScore: res.evaluation.overallScore, evaluation: res.evaluation } };
      setAnswers(nextAnswers);
      setFeedback(res.evaluation);
      session.remove(KEYS.draft(id, current._id));
    } catch (err) {
      if (err.status === 409 && err.data?.evaluation) {
        setAnswers((a) => ({ ...a, [current._id]: { overallScore: err.data.evaluation.overallScore, evaluation: err.data.evaluation } }));
        setFeedback(err.data.evaluation);
      } else if (err.status === 409) {
        toast.error(err.message);
        finish('time_expired');
      } else {
        toast.error(err.message || 'Could not submit your answer. It is saved as a draft — try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    const nextId = nextOpenQuestion(current._id);
    if (!nextId) {
      finish('all_answered');
      return;
    }
    goTo(nextId);
  };

  const skip = () => {
    const nextId = nextOpenQuestion(current._id);
    if (nextId && nextId !== current._id) goTo(nextId);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadError) {
    return <ErrorState title="Interview unavailable" message={loadError.message} action={<Link to="/dashboard" className="link text-sm">Back to dashboard</Link>} />;
  }
  if (phase === 'loading' || !interview) return <PageLoader label="Preparing interview room…" />;

  if (phase === 'terminated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-md p-8 text-center animate-scale-in">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="display mt-5 text-2xl">Interview ended</h1>
          <p className="mt-2 text-ink-2">{termination?.message}</p>
          <p className="mt-4 text-sm text-ink-3">Answers you submitted before this point have been scored. Unanswered questions count as zero.</p>
          <Button as={Link} to={`/interviews/${id}/results`} replace className="mt-6 w-full" size="lg" iconRight={ArrowRight}>
            View your report
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'finishing') {
    return <PageLoader label="Submitting your interview…" />;
  }

  const timeCritical = remaining !== null && remaining <= 120;
  const words = wordCount(draft);
  const isCurrentAnswered = Boolean(current && answers[current._id]);
  const pendingEntries = Object.entries(pending).filter(([, p]) => p.elapsed / p.threshold > 0.35);

  if (phase === 'gate') {
    const resuming = interview.status === 'in_progress';
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card grid w-full max-w-4xl gap-8 p-6 sm:p-8 md:grid-cols-[1fr_1fr] animate-scale-in">
          <div className="flex flex-col">
            <LogoMark className="h-9 w-9" />
            <h1 className="display mt-5 text-3xl">{resuming ? 'Resume your interview' : 'Ready when you are'}</h1>
            <p className="mt-2 text-ink-2">{interview.title}</p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-2">
              <li className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-ink-3" aria-hidden="true" /> {pluralize(questions.length, 'question')}
                {answeredCount > 0 && ` · ${answeredCount} answered`}
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-ink-3" aria-hidden="true" />
                {resuming && remaining !== null ? `${formatClock(remaining)} left` : `${interview.durationMinutes} minutes — the timer starts now`}
              </li>
              <li className="flex items-center gap-2.5">
                <Maximize className="h-4 w-4 text-ink-3" aria-hidden="true" /> Full-screen; leaving it ends the interview
              </li>
              <li className="flex items-center gap-2.5">
                <Keyboard className="h-4 w-4 text-ink-3" aria-hidden="true" /> Ctrl/⌘ + Enter submits an answer
              </li>
            </ul>
            {gateError && (
              <Alert tone="danger" className="mt-6">
                {gateError}
              </Alert>
            )}
            {camera.error && cameraWanted && (
              <Alert tone="warning" className="mt-6" title="Camera unavailable">
                <p>{camera.error}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" className="link text-sm" onClick={() => setCameraWanted(false)}>
                    Continue without camera
                  </button>
                  <Link to={`/interviews/${id}/prep`} className="link text-sm">
                    Back to system check
                  </Link>
                </div>
              </Alert>
            )}
            <div className="mt-auto pt-8">
              <Button size="lg" className="w-full" icon={Maximize} onClick={begin} isLoading={starting}>
                {resuming ? 'Enter full-screen and resume' : 'Enter full-screen and begin'}
              </Button>
              {!setup && cameraWanted && (
                <p className="mt-3 text-center text-xs text-ink-3">
                  Skipped the system check?{' '}
                  <Link to={`/interviews/${id}/prep`} className="link">
                    Calibrate first
                  </Link>{' '}
                  for fairer gaze tracking.
                </p>
              )}
            </div>
          </div>
          <div>
            {cameraWanted ? (
              <>
                <CameraView videoRef={videoRef} canvasRef={canvasRef} cameraState={camera.state} cameraError={camera.error} status={vision.status} live={vision.live} />
                <p className="mt-3 text-xs text-ink-3">
                  {camera.state === 'active' ? 'Camera is on. Frames are analysed on this device only.' : 'Your camera turns on when you begin.'}
                </p>
              </>
            ) : (
              <Alert tone="warning" title="Not monitored">
                This interview will run without camera proctoring. Browser rules (full-screen, tab switching) still apply.
              </Alert>
            )}
          </div>
        </div>
      </div>
    );
  }

  // phase === 'active'
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 lg:px-6">
          <LogoMark className="h-7 w-7 shrink-0" />
          <p className="hidden min-w-0 truncate text-sm font-medium text-ink md:block">{interview.title}</p>
          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-2 sm:flex" title="Proctoring warnings">
              <span className="text-xs text-ink-3">Warnings</span>
              <WarningPips count={warnings.length} />
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ${timeCritical ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink'}`}
              role="timer"
              aria-label={`Time remaining ${formatClock(remaining ?? 0)}`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              {remaining === null ? '--:--' : formatClock(remaining)}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setConfirmFinish(true)}>
              Finish
            </Button>
          </div>
        </div>
      </header>

      {banner && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4" role="alert">
          <div className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl border border-warning/40 bg-surface p-3.5 shadow-raised animate-slide-down">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold text-ink">
                Warning {banner.count} of {MAX_WARNINGS}
              </p>
              <p className="text-ink-2">{banner.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
        <section className="min-w-0 space-y-4" aria-label="Question and answer">
          <nav aria-label="Questions" className="flex flex-wrap items-center gap-2">
            {questions.map((q, i) => {
              const done = Boolean(answers[q._id]);
              const active = q._id === currentId;
              return (
                <button
                  key={q._id}
                  type="button"
                  onClick={() => goTo(q._id)}
                  aria-current={active ? 'step' : undefined}
                  aria-label={`Question ${i + 1}${done ? ', answered' : ''}`}
                  className={`num flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-accent bg-accent text-accent-fg'
                      : done
                        ? 'border-success/30 bg-success-soft text-success'
                        : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                  }`}
                >
                  {done && !active ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  {i + 1}
                </button>
              );
            })}
            <span className="ml-1 text-sm text-ink-3">
              {answeredCount}/{questions.length} answered
            </span>
          </nav>

          {current && (
            <article className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{TOPIC_SHORT[current.topic] || current.topic}</Badge>
                <Badge>{current.difficulty}</Badge>
                {current.type !== 'Technical' && <Badge tone="brass">{current.type} · use STAR</Badge>}
              </div>
              <h1 className="mt-4 font-serif text-xl font-semibold leading-snug text-ink sm:text-2xl">{current.questionText}</h1>
            </article>
          )}

          {feedback && isCurrentAnswered ? (
            <FeedbackPanel
              evaluation={feedback}
              onNext={handleNext}
              isLast={!nextOpenQuestion(current._id)}
              nextLabel={nextOpenQuestion(current._id) ? 'Next question' : 'Finish and view report'}
            />
          ) : isCurrentAnswered ? (
            <div className="card flex flex-col items-start gap-3 p-6">
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" /> Answered — scored {answers[current._id].overallScore}/100.
              </p>
              <Button onClick={handleNext} iconRight={ArrowRight}>
                {nextOpenQuestion(current._id) ? 'Go to next unanswered' : 'Finish and view report'}
              </Button>
            </div>
          ) : (
            <div className="card p-4 sm:p-5">
              <label htmlFor="answer" className="sr-only">
                Your answer
              </label>
              <textarea
                id="answer"
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  inputModeRef.current.typed = true;
                  setDraft(e.target.value.slice(0, MAX_ANSWER_LENGTH));
                }}
                onKeyDown={(e) => {
                  vision.engineRef.current?.noteTyping();
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={submitting}
                rows={12}
                spellCheck
                placeholder={
                  current?.type === 'Technical'
                    ? 'Explain your reasoning: definition → how it works → trade-offs → an example. You can also dictate.'
                    : 'Situation → Task → Action → Result. Be specific about what you did and the outcome.'
                }
                className="field-input min-h-[260px] resize-y border-0 bg-transparent px-1 text-[15px] leading-relaxed shadow-none hover:border-0 focus:ring-0"
              />
              {dictation.listening && (
                <p className="px-1 pb-2 text-sm italic text-ink-3" aria-live="polite">
                  {dictation.interim || 'Listening…'}
                </p>
              )}
              {dictation.error && <p className="px-1 pb-2 text-xs text-danger">{dictation.error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="flex items-center gap-2">
                  {dictation.supported && (
                    <Button
                      variant={dictation.listening ? 'danger' : 'secondary'}
                      size="sm"
                      icon={dictation.listening ? MicOff : Mic}
                      onClick={dictation.toggle}
                      disabled={submitting}
                      aria-pressed={dictation.listening}
                    >
                      {dictation.listening ? 'Stop dictation' : 'Dictate'}
                    </Button>
                  )}
                  <span className="num text-xs text-ink-3">
                    {words} words · {draft.length}/{MAX_ANSWER_LENGTH}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {questions.length - answeredCount > 1 && (
                    <Button variant="ghost" size="sm" icon={SkipForward} onClick={skip} disabled={submitting}>
                      Skip for now
                    </Button>
                  )}
                  <Button onClick={handleSubmit} isLoading={submitting} disabled={!draft.trim()} icon={Send}>
                    {submitting ? 'Scoring…' : 'Submit answer'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4" aria-label="Proctoring">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Video className="h-4 w-4 text-accent-ink" aria-hidden="true" /> Proctoring
              </h2>
              <div className="flex items-center gap-2 sm:hidden">
                <WarningPips count={warnings.length} />
              </div>
            </div>
            {cameraWanted ? (
              <>
                <CameraView videoRef={videoRef} canvasRef={canvasRef} cameraState={camera.state} cameraError={camera.error} onStart={camera.start} status={vision.status} live={vision.live} />
                {pendingEntries.length > 0 && (
                  <div className="mt-3 space-y-2" aria-live="polite">
                    {pendingEntries.map(([rule, p]) => (
                      <div key={rule} className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-ink">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{RULE_LABELS[rule] || rule}</span>
                          <span className="num text-ink-2">warning in {Math.max(0, Math.ceil(p.threshold - p.elapsed))}s</span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-warning/20">
                          <div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(100, (p.elapsed / p.threshold) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <VisionReadout live={vision.live} status={vision.status} hasAudio={camera.hasAudio} />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-3">Camera monitoring is off for this interview.</p>
            )}
          </div>

          <div className="card p-4">
            <button type="button" onClick={() => setShowLog((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-ink" aria-expanded={showLog}>
              <span>
                Warnings · <span className="num">{warnings.length}/{MAX_WARNINGS}</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform ${showLog ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {showLog && (
              <ul className="mt-3 space-y-2">
                {warnings.length === 0 ? (
                  <li className="text-sm text-ink-3">No warnings so far.</li>
                ) : (
                  warnings.map((w) => (
                    <li key={w.id} className="flex gap-2 text-xs text-ink-2">
                      <span className="num shrink-0 text-ink-3">{w.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      {w.message}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        onConfirm={() => finish('submitted_early')}
        dismissible={false}
        title="Finish the interview?"
        description={
          allAnswered
            ? 'All questions are answered. Your report is ready.'
            : `${questions.length - answeredCount} question${questions.length - answeredCount === 1 ? ' is' : 's are'} unanswered and will score zero.${draft.trim() && !isCurrentAnswered ? ' Your current draft will be submitted first.' : ''}`
        }
        confirmLabel="Finish and see report"
        cancelLabel="Keep going"
      />
      {submitting && <span className="sr-only" role="status"><Loader2 /> Scoring your answer</span>}
    </div>
  );
};

export default InterviewRoom;
