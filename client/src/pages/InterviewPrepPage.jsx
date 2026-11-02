import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Circle,
  Crosshair,
  Loader2,
  Maximize,
  Mic,
  ScanFace,
  ShieldAlert,
  Timer,
  ListChecks,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { useAsync, useDocumentTitle } from '../hooks/useAsync';
import { useCamera, useVideoStream } from '../hooks/useCamera';
import { useElementRef } from '../hooks/useElementRef';
import { useVisionEngine } from '../hooks/useVisionEngine';
import { dictationSupported } from '../hooks/useDictation';
import { fullscreenSupported } from '../hooks/useExamLockdown';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Alert, ErrorState, PageLoader } from '../components/ui/Feedback';
import { PageContainer } from '../components/layout/PageHeader';
import { CameraView, VisionReadout } from '../components/proctoring/CameraPanel';
import { PROCTORING_POLICY } from '../services/cv/policy';
import { saveProctoringSetup } from '../services/proctoringSession';
import { TOPIC_SHORT } from '../lib/constants';
import { pluralize } from '../lib/format';
import api from '../services/api';

const CALIBRATION_MS = 3000;

const Check = ({ state, title, detail }) => {
  const Icon = { ok: CheckCircle2, pending: Circle, loading: Loader2, warn: AlertTriangle, fail: XCircle }[state];
  const tone = { ok: 'text-success', pending: 'text-ink-3', loading: 'text-ink-3 animate-spin', warn: 'text-warning', fail: 'text-danger' }[state];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {detail && <p className="text-xs text-ink-3">{detail}</p>}
      </div>
      <span className="sr-only">{state}</span>
    </li>
  );
};

const RULES = [
  { tone: 'danger', text: 'Leaving full-screen, switching tabs, or switching apps ends the interview immediately.' },
  { tone: 'warning', text: `Being out of frame for ${PROCTORING_POLICY.absenceSeconds}s, looking away for ${PROCTORING_POLICY.lookAwaySeconds}s, another person, a phone, or voices while you are silent each give a warning.` },
  { tone: 'warning', text: 'Copy, paste, right-click and developer tools are blocked; attempts give a warning.' },
  { tone: 'danger', text: `The interview ends after ${PROCTORING_POLICY.maxWarnings} warnings. Answers already submitted are kept and scored.` },
];

export const InterviewPrepPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [videoRef, videoEl] = useElementRef();
  const [canvasRef, canvasEl] = useElementRef();
  const camera = useCamera();
  const [heardVoice, setHeardVoice] = useState(false);
  const [calibration, setCalibration] = useState({ state: 'idle', progress: 0, result: null });
  const [consent, setConsent] = useState(false);
  const [skipCamera, setSkipCamera] = useState(false);

  const { data: interview, loading, error, reload } = useAsync(async () => (await api.get(`/interviews/${id}`)).interview, [id]);
  useDocumentTitle(interview ? 'System check' : 'Loading interview');

  useEffect(() => {
    if (interview && ['completed', 'terminated', 'abandoned'].includes(interview.status)) {
      navigate(`/interviews/${id}/results`, { replace: true });
    }
  }, [interview, id, navigate]);

  useVideoStream(videoEl, camera.stream);
  const onFrame = useCallback((f) => {
    if (f.voice) setHeardVoice(true);
  }, []);
  const vision = useVisionEngine({ video: videoEl, canvas: canvasEl, stream: camera.stream, enabled: camera.state === 'active', onFrame });

  const live = vision.live;
  const visionReady = vision.status.state === 'ready' || vision.status.state === 'basic';
  const faceOk = live?.faceCount === 1;
  const calibrated = calibration.state === 'done';

  const calibrate = async () => {
    const engine = vision.engineRef.current;
    if (!engine) return;
    setCalibration({ state: 'running', progress: 0, result: null });
    const started = performance.now();
    const timer = setInterval(() => {
      setCalibration((c) => (c.state === 'running' ? { ...c, progress: Math.min(1, (performance.now() - started) / CALIBRATION_MS) } : c));
    }, 100);
    const result = await engine.calibrate(CALIBRATION_MS);
    clearInterval(timer);
    setCalibration({ state: result.ok ? 'done' : 'failed', progress: 1, result });
  };

  const fsSupported = fullscreenSupported();
  const cameraReady = camera.state === 'active';
  const canStart = consent && (skipCamera || (cameraReady && visionReady && (calibrated || vision.status.state === 'basic')));

  const start = () => {
    const engine = vision.engineRef.current;
    saveProctoringSetup(id, {
      camera: !skipCamera && cameraReady,
      calibrated,
      baseline: calibration.result?.baseline || null,
      noiseFloorDb: calibration.result?.noiseFloorDb ?? engine?.noiseFloorDb ?? null,
    });
    camera.stop();
    navigate(`/interviews/${id}/room`);
  };

  if (loading) return <PageLoader label="Loading interview…" />;
  if (error) return <ErrorState title="Interview unavailable" message={error.message} onRetry={reload} action={<Link to="/dashboard" className="link text-sm">Dashboard</Link>} />;
  if (!interview) return null;

  const cameraCheck =
    camera.state === 'active' ? 'ok' : camera.state === 'requesting' ? 'loading' : camera.state === 'error' || camera.state === 'ended' ? 'fail' : 'pending';

  return (
    <PageContainer size="full">
      <div className="flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">System check</p>
          <h1 className="display mt-2 text-3xl sm:text-4xl">{interview.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge icon={ListChecks}>{pluralize(interview.questions.length, 'question')}</Badge>
            <Badge icon={Timer}>{interview.durationMinutes} min</Badge>
            {interview.topics.map((t) => (
              <Badge key={t} tone="accent">
                {TOPIC_SHORT[t] || t}
              </Badge>
            ))}
            {interview.status === 'in_progress' && <Badge tone="brass" dot>In progress — timer running</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Camera className="h-4 w-4 text-accent-ink" aria-hidden="true" /> Camera & vision
            </h2>
            {cameraReady && (
              <Button variant="ghost" size="sm" onClick={camera.stop}>
                Turn off
              </Button>
            )}
          </div>
          <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
            <CameraView
              videoRef={videoRef}
              canvasRef={canvasRef}
              cameraState={camera.state}
              cameraError={camera.error}
              onStart={camera.start}
              status={vision.status}
              live={live}
            >
              {calibration.state === 'running' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 text-white">
                  <Crosshair className="h-10 w-10 animate-pulse" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">Look at the centre of your screen</p>
                  <div className="mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/25">
                    <div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${calibration.progress * 100}%` }} />
                  </div>
                </div>
              )}
            </CameraView>
            <div>{cameraReady ? <VisionReadout live={live} status={vision.status} hasAudio={camera.hasAudio} /> : <p className="text-sm text-ink-3">Turn on your camera to run the checks. Video is processed on this device and never uploaded.</p>}</div>
          </div>

          <ol className="mt-6 divide-y divide-line border-t border-line">
            <Check state={cameraCheck} title="Camera access" detail={camera.error || (cameraReady ? 'Camera stream active' : 'Needed for proctoring')} />
            <Check
              state={!cameraReady ? 'pending' : vision.status.state === 'loading' ? 'loading' : vision.status.state === 'ready' ? 'ok' : vision.status.state === 'basic' ? 'warn' : 'pending'}
              title="Vision models"
              detail={vision.status.message || 'Face landmarks and object detection, running locally'}
            />
            <Check
              state={!cameraReady || !live ? 'pending' : faceOk ? 'ok' : 'fail'}
              title="One face in view"
              detail={!live ? 'Waiting for the camera' : live.faceCount === 0 ? 'No face detected — check lighting and framing' : live.faceCount > 1 ? 'More than one face detected' : 'Only you are in frame'}
            />
            <Check
              state={!cameraReady ? 'pending' : !camera.hasAudio ? 'warn' : heardVoice ? 'ok' : 'pending'}
              title="Microphone"
              detail={!camera.hasAudio ? 'No microphone — voice checks and dictation are off' : heardVoice ? 'We can hear you' : 'Say a few words to test'}
            />
            <li className="flex items-start justify-between gap-3 py-2.5">
              <div className="flex items-start gap-3">
                {calibrated ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                ) : calibration.state === 'failed' ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                ) : (
                  <ScanFace className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-medium text-ink">Calibrate your neutral pose</p>
                  <p className="text-xs text-ink-3">
                    {calibrated
                      ? `Done — head ${Math.round(calibration.result.baseline.yaw)}° / ${Math.round(calibration.result.baseline.pitch)}°, so your camera angle won’t count against you.`
                      : calibration.state === 'failed'
                        ? 'Couldn’t see your face clearly enough. Adjust lighting and try again.'
                        : 'Sit as you will during the interview and look at the screen for 3 seconds.'}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant={calibrated ? 'ghost' : 'secondary'}
                onClick={calibrate}
                disabled={!faceOk || vision.status.state !== 'ready' || calibration.state === 'running'}
                isLoading={calibration.state === 'running'}
              >
                {calibrated ? 'Redo' : 'Calibrate'}
              </Button>
            </li>
            <Check state={fsSupported ? 'ok' : 'warn'} title="Full-screen mode" detail={fsSupported ? 'Supported in this browser' : 'Not supported here (common on iPhone) — the interview runs without it'} />
            <Check
              state={dictationSupported() ? 'ok' : 'warn'}
              title="Dictation (optional)"
              detail={dictationSupported() ? 'You can speak your answers' : 'Not available in this browser — you can still type'}
            />
          </ol>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <ShieldAlert className="h-4 w-4 text-accent-ink" aria-hidden="true" /> Interview rules
            </h2>
            <ul className="mt-4 space-y-3">
              {RULES.map((r) => (
                <li key={r.text} className="flex gap-3 text-sm text-ink-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.tone === 'danger' ? 'bg-danger' : 'bg-warning'}`} aria-hidden="true" />
                  {r.text}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-surface-2 p-3 text-xs text-ink-3">
              Glancing down at your keyboard while typing is fine. Short look-aways reset and don’t count. The camera feed is analysed
              on this device and never recorded or uploaded.
            </p>
          </Card>

          <Card>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-[rgb(var(--accent))]"
              />
              <span className="text-sm text-ink-2">I understand the rules and agree to camera and microphone monitoring for this interview.</span>
            </label>

            {(camera.state === 'error' || camera.state === 'ended') && (
              <Alert tone="warning" className="mt-4" title="Camera unavailable">
                <p>You can still practice without proctoring. Your report will be marked as not monitored.</p>
                <label className="mt-2 flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={skipCamera} onChange={(e) => setSkipCamera(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                  Continue without camera
                </label>
              </Alert>
            )}

            <Button size="lg" className="mt-5 w-full" iconRight={ArrowRight} disabled={!canStart} onClick={start}>
              {interview.status === 'in_progress' ? 'Return to interview' : 'Continue to interview'}
            </Button>
            {!canStart && (
              <p className="mt-2 text-center text-xs text-ink-3">
                {!consent
                  ? 'Accept the rules to continue.'
                  : !cameraReady && !skipCamera
                    ? 'Turn on your camera to continue.'
                    : !calibrated
                      ? 'Calibrate to continue.'
                      : 'Finishing checks…'}
              </p>
            )}
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-3">
              <Maximize className="h-3.5 w-3.5" aria-hidden="true" /> Next you’ll enter full-screen, then the {interview.durationMinutes}-minute timer starts.
            </p>
            {!camera.hasAudio && cameraReady && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-3">
                <Mic className="h-3.5 w-3.5" aria-hidden="true" /> No microphone detected.
              </p>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};

export default InterviewPrepPage;
