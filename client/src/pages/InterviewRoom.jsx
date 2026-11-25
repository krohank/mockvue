import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Check, Video, VideoOff, Volume2, Square, Send, SkipForward, Maximize2, Minimize2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { AudioAnswer } from '../components/AudioAnswer';
import { AnswerFeedback, feedbackPending } from '../components/AnswerFeedback';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { enterInterviewFullscreen } from '../services/fullscreen';
import { watchFocus } from '../services/focusGuard';
import { startCamera, stopCamera, attachStream, onCameraLost, cameraPermission, rememberCamera, cameraWasOn } from '../services/camera';

const formatTime = (seconds) => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
export const InterviewRoom = () => {
  const { id } = useParams(), navigate = useNavigate(), { user } = useAuth();
  const [interview, setInterview] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0), [answerText, setAnswerText] = useState(''), [evaluation, setEvaluation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false), [isFinishing, setIsFinishing] = useState(false), [isStarting, setIsStarting] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false), [draftStatus, setDraftStatus] = useState(''), [finishOpen, setFinishOpen] = useState(false);
  const [deadline, setDeadline] = useState(null), [secondsLeft, setSecondsLeft] = useState(0), [sessionComplete, setSessionComplete] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement)), [cameraOn, setCameraOn] = useState(false), [cameraError, setCameraError] = useState('');
  const [fullscreenNotice, setFullscreenNotice] = useState(''), [changingFullscreen, setChangingFullscreen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const video = useRef(null), camera = useRef(null), mounted = useRef(true), usedVoice = useRef(false), answerRef = useRef('');
  const submitting = useRef(false), finishing = useRef(false), voiceActive = useRef(false), finishRef = useRef(null), serverOffset = useRef(0), questionStarted = useRef(Date.now());
  const voicePrompt = useRef(false), draftReliable = useRef(true), autoAttempted = useRef(false), cameraLost = useRef(null), terminating = useRef(false);
  const questions = interview?.questions || [], currentQuestion = questions[currentIndex];
  const started = interview?.status === 'in_progress';
  const assessment = interview?.mode === 'assessment';
  const draftKey = useCallback((questionId) => 'mockvue_draft_' + user?._id + '_' + id + '_' + questionId, [user?._id, id]);
  const updateAnswer = useCallback((value, isVoice = false) => {
    const next = typeof value === 'function' ? value(answerRef.current) : value;
    answerRef.current = next; setAnswerText(next);
    if (isVoice) usedVoice.current = true;
    if (!currentQuestion) return;
    try {
      localStorage.setItem(draftKey(currentQuestion._id), JSON.stringify({ text: next, voice: usedVoice.current, startedAt: questionStarted.current, updatedAt: Date.now() + serverOffset.current }));
      draftReliable.current = true; setDraftStatus('Draft saved on this device');
    } catch { draftReliable.current = false; setDraftStatus('Draft could not be saved. Keep this page open.'); }
  }, [currentQuestion?._id, draftKey]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    api.get('/interviews/' + id, { signal: controller.signal }).then((res) => {
      if (!mounted.current) return;
      if (['completed', 'terminated'].includes(res.interview.status)) {
        navigate('/interviews/' + id + '/results', { replace: true }); return;
      }
      setInterview(res.interview); setCurrentIndex(res.interview.currentQuestionIndex || 0);
      serverOffset.current = Date.parse(res.serverTime) - Date.now();
      if (res.interview.endsAt) setDeadline(Date.parse(res.interview.endsAt));
      setLoading(false);
    }).catch((err) => { if (mounted.current && err.code !== 'ERR_CANCELED') { setError(err.message); setLoading(false); } });
    return () => { mounted.current = false; controller.abort(); };
  }, [id, navigate]);
  useLayoutEffect(() => {
    if (!currentQuestion?._id) return;
    usedVoice.current = false; setEvaluation(null); setDraftStatus(''); questionStarted.current = Date.now();
    try {
      const local = JSON.parse(localStorage.getItem(draftKey(currentQuestion._id)) || 'null');
      const remote = interview?.draft;
      const draft = remote?.questionId === currentQuestion._id && Date.parse(remote.savedAt) > (local?.updatedAt || 0)
        ? { text: remote.responseText, voice: remote.responseType === 'voice' } : local;
      const text = typeof draft?.text === 'string' ? draft.text : '';
      answerRef.current = text; setAnswerText(text); usedVoice.current = Boolean(draft?.voice);
      if (Number.isFinite(draft?.startedAt)) questionStarted.current = draft.startedAt;
      if (text) setDraftStatus('Saved draft restored');
    } catch { answerRef.current = ''; setAnswerText(''); }
  }, [currentQuestion?._id, draftKey]);
  useEffect(() => {
    if (!started || !currentQuestion || evaluation || isSubmitting || isFinishing) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const text = answerRef.current;
      api.put('/interviews/' + id + '/draft', {
        questionId: currentQuestion._id, responseText: text, responseType: usedVoice.current ? 'voice' : 'text',
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - questionStarted.current) / 1000)),
      }, { signal: controller.signal, timeout: 10000 }).then(() => {
        if (!controller.signal.aborted && mounted.current && answerRef.current === text) setDraftStatus('Draft synced');
      }).catch((err) => {
        if (!controller.signal.aborted && mounted.current && err.code !== 'ERR_CANCELED') setDraftStatus('Saved on this device. Server sync unavailable.');
      });
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [answerText, currentQuestion?._id, id, started, evaluation, isSubmitting, isFinishing]);
  useEffect(() => {
    if (!deadline || sessionComplete) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now() - serverOffset.current) / 1000));
      setSecondsLeft(remaining);
      if (!remaining && !autoAttempted.current && !submitting.current && !finishing.current && !voiceActive.current) { autoAttempted.current = true; finishRef.current?.({ automatic: true }); }
    };
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, sessionComplete]);
  useEffect(() => {
    const beforeUnload = (event) => {
      if ((answerRef.current.trim() && !draftReliable.current) || voiceActive.current || submitting.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  useEffect(() => {
    const change = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      if (active) setFullscreenNotice('');
    };
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  // Record the violation, then end the assessment. Only one violation is handled, even when
  // leaving full screen, losing focus and hiding the tab all fire together.
  const terminate = async (eventType, reason) => {
    if (finishing.current || terminating.current) return;
    terminating.current = true;
    try {
      await api.post('/interviews/' + id + '/monitoring', { eventType, description: reason }, { timeout: 4000 }).catch(() => {});
      await finishRef.current?.({ terminated: true, reason });
    } finally { terminating.current = false; }
  };
  useEffect(() => {
    if (!assessment || !started || sessionComplete) return;
    const change = () => {
      // Permission dialogs may temporarily leave full screen. Never discard a voice answer.
      if (!document.fullscreenElement && !voicePrompt.current) terminate('fullscreen_exit', 'Interview ended because full-screen mode was exited.');
    };
    // Covers a hidden tab and also Alt+Tab or clicking another window, which only removes focus.
    const stopWatching = watchFocus({
      isPaused: () => voicePrompt.current,
      onViolation: (kind) => kind === 'hidden'
        ? terminate('tab_switched', 'Interview ended because you left the interview tab.')
        : terminate('window_blurred', 'Interview ended because you switched to another window or app.'),
    });
    document.addEventListener('fullscreenchange', change);
    return () => { document.removeEventListener('fullscreenchange', change); stopWatching(); };
  }, [assessment, started, sessionComplete]);
  useEffect(() => () => {
    cameraLost.current?.(); stopCamera(camera.current);
    window.speechSynthesis?.cancel();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    if (!feedbackPending(evaluation)) return;
    const controller = new AbortController();
    let timer, delay = 2000;
    const poll = async () => {
      try {
        const result = await api.get('/interviews/' + id, { signal: controller.signal });
        const updated = result.interview.answers.find((a) => a._id === evaluation._id);
        if (!controller.signal.aborted && updated) setEvaluation(updated);
      } catch { /* Saved answers remain available on the results page. */ }
      if (!controller.signal.aborted) { delay = Math.min(delay * 2, 10000); timer = setTimeout(poll, delay); }
    };
    timer = setTimeout(poll, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [id, evaluation?._id, evaluation?.evaluationStatus]);
  useEffect(() => { attachStream(video.current, camera.current); }, [cameraOn]);
  // Resume the preview the student turned on during setup. Only when permission is already
  // granted, so no camera prompt can appear in the middle of an interview.
  useEffect(() => {
    if (!started || camera.current || !cameraWasOn()) return;
    let cancelled = false;
    (async () => {
      if (await cameraPermission() !== 'granted' || cancelled) return;
      voicePrompt.current = true;
      try { await startPreview(); } catch (err) { if (!cancelled) setCameraError(err.message); } finally { voicePrompt.current = false; }
    })();
    return () => { cancelled = true; };
  }, [started]);

  const start = async () => {
    if (isStarting) return;
    setIsStarting(true); setError(''); setFullscreenNotice('');
    try {
      try {
        await enterInterviewFullscreen();
        setFullscreen(Boolean(document.fullscreenElement));
      } catch (err) {
        if (assessment) throw err;
        setFullscreenNotice(err.message + ' You can continue practicing in this window.');
      }
      const result = await api.post('/interviews/' + id + '/start');
      serverOffset.current = Date.parse(result.serverTime) - Date.now();
      setDeadline(Date.parse(result.endsAt));
      setInterview((value) => ({ ...value, status: 'in_progress', startedAt: result.startedAt }));
      questionStarted.current = Date.now();
    } catch (err) { setError(err.message || 'Could not start. Please try again.'); }
    finally { setIsStarting(false); }
  };
  const toggleFullscreen = async () => {
    if (changingFullscreen || (assessment && document.fullscreenElement)) return;
    setChangingFullscreen(true); setFullscreenNotice('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await enterInterviewFullscreen();
      setFullscreen(Boolean(document.fullscreenElement));
    } catch (err) { setFullscreenNotice(err.message || 'Could not change full screen. Please try again.'); }
    finally { setChangingFullscreen(false); }
  };
  const submit = async (skipped = false) => {
    if (submitting.current || evaluation || (!skipped && !answerRef.current.trim())) return null;
    submitting.current = true; setIsSubmitting(true); setError(''); window.speechSynthesis?.cancel();
    try {
      const result = await api.post('/interviews/' + id + '/answer', {
        questionId: currentQuestion._id, responseText: answerRef.current, responseType: usedVoice.current ? 'voice' : 'text', skipped,
        timeSpentSeconds: Math.max(0, Math.round((Date.now() - questionStarted.current) / 1000)),
      }, { timeout: 135000 });
      setEvaluation(result.evaluation); setSessionComplete(result.isComplete);
      try { localStorage.removeItem(draftKey(currentQuestion._id)); } catch {}
      setDraftStatus('Answer saved');
      return result;
    } catch (err) { setError(err.message || 'Could not save your answer. Your draft is still here.'); throw err; }
    finally { submitting.current = false; setIsSubmitting(false); }
  };
  const finish = async ({ automatic = false, terminated = false, reason = null } = {}) => {
    // A violation must end the assessment even while an answer is being saved.
    if (finishing.current || (submitting.current && !terminated)) return;
    finishing.current = true; setIsFinishing(true); setFinishOpen(false); setError('');
    try {
      if (!terminated && answerRef.current.trim() && !evaluation && !voiceActive.current && (!deadline || Date.now() + serverOffset.current < deadline + (assessment ? 2000 : 120000))) {
        try { await submit(); } catch (err) { if (!automatic) throw err; }
      }
      await api.post('/interviews/' + id + '/complete', { terminated, reason }, { timeout: 135000 });
      setSessionComplete(true); window.speechSynthesis?.cancel();
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      navigate('/interviews/' + id + '/results', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not finish the interview. Your draft is saved. Please retry.');
      finishing.current = false; setIsFinishing(false);
    }
  };
  finishRef.current = finish;
  const next = () => {
    if (sessionComplete) { finishing.current = true; navigate('/interviews/' + id + '/results'); return; }
    setEvaluation(null); setCurrentIndex((index) => index + 1);
  };
  const stopPreview = () => { cameraLost.current?.(); cameraLost.current = null; stopCamera(camera.current); camera.current = null; setCameraOn(false); };
  async function startPreview() {
    const stream = await startCamera();
    if (!mounted.current) { stopCamera(stream); return; }
    camera.current = stream;
    cameraLost.current = onCameraLost(stream, () => {
      camera.current = null; cameraLost.current = null; setCameraOn(false); rememberCamera(false);
      setCameraError('The camera stopped. It may have been unplugged or taken by another app. Turn the preview on to retry.');
    });
    setCameraOn(true); rememberCamera(true);
  }
  const toggleCamera = async () => {
    if (cameraOn) { rememberCamera(false); stopPreview(); return; }
    setCameraError(''); voicePrompt.current = true;
    try { await startPreview(); } catch (err) { setCameraError(err.message + ' You can continue without a preview.'); } finally { voicePrompt.current = false; }
  };
  const readQuestion = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const speech = new SpeechSynthesisUtterance(currentQuestion.questionText);
    speech.lang = 'en-US'; speech.rate = 0.95;
    speech.onend = () => setSpeaking(false); speech.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(speech); setSpeaking(true);
  };

  if (loading) return <div className="min-h-[65vh] flex items-center justify-center"><Spinner size="lg" label="Loading your interview…" /></div>;
  if (!interview || !currentQuestion) return <div className="max-w-xl mx-auto px-5 py-20 space-y-4"><h1 className="font-serif text-3xl font-bold">Interview unavailable</h1><p role="alert">{error || 'No questions were found for this interview.'}</p><Link to="/dashboard"><Button variant="outline">Back to dashboard</Button></Link></div>;
  const locked = isSubmitting || isFinishing || voiceBusy;
  const needsStart = !started || (assessment && !fullscreen && !voiceBusy);
  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#DED9D0] dark:border-[#332F2A] pb-6">
        <div className="min-w-0 max-w-2xl">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[#68645E] dark:text-[#9E988F] hover:underline mb-3"><ArrowLeft className="w-3.5 h-3.5" />Dashboard</Link>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-tight">{interview.targetRole}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Badge variant="brand">{assessment ? 'Assessment' : 'Practice'}</Badge>{started && <span className="lg:hidden text-xs">Question {currentIndex + 1} of {questions.length}</span>}<Badge>{interview.difficulty}</Badge>
            <span className="text-xs text-[#68645E] dark:text-[#9E988F]">{interview.isFallbackAI ? 'Question bank' : interview.questionProvider === 'local' ? 'Local AI questions' : 'AI questions'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div role="timer" aria-label="Time remaining" className={'flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-lg ' + (started && secondsLeft < 120 ? 'border-[#E8C4C4] text-[#A33B3B]' : 'border-[#DED9D0] dark:border-[#332F2A]')}>
            <Clock className="w-4 h-4" />{started ? formatTime(secondsLeft) : interview.durationMinutes + ':00'}
          </div>
          {started && <Button variant="outline" icon={fullscreen && !assessment ? Minimize2 : Maximize2} onClick={toggleFullscreen} isLoading={changingFullscreen} disabled={locked || (assessment && fullscreen)} title={assessment && fullscreen ? 'Full screen is required during an assessment.' : undefined}>{fullscreen ? assessment ? 'Full screen active' : 'Exit full screen' : 'Enter full screen'}</Button>}
          {started && <button type="button" className="lg:hidden p-2 rounded-lg border border-[#DED9D0] dark:border-[#332F2A]" aria-label={cameraOn ? 'Turn off camera preview' : 'Turn on camera preview'} onClick={toggleCamera}>{cameraOn ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}</button>}
          {started && <Button variant="outline" onClick={() => setFinishOpen(true)} disabled={locked} isLoading={isFinishing}>Finish</Button>}
        </div>
      </div>
      {error && <div role="alert" className="mv-alert"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
      {fullscreenNotice && <p role="status" className="text-sm text-[#68645E] dark:text-[#9E988F]">{fullscreenNotice}</p>}
      {needsStart ? (
        <Card className="max-w-2xl mx-auto !p-8 sm:!p-10 text-center space-y-5 my-12">
          <span className="inline-flex rounded-full bg-[#F0ECE4] dark:bg-[#24201C] p-4"><MicIcon /></span>
          <h2 className="font-serif text-3xl font-bold">{started ? 'Return to your interview' : 'Ready when you are'}</h2>
          <p className="text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">{questions.length} questions · {interview.durationMinutes} minutes. Type your answers or record them. You can review each transcript before submitting.</p>
          <p className="text-xs text-[#68645E] dark:text-[#9E988F]">{assessment ? 'Stay in this tab in full-screen mode. Leaving ends this assessment.' : 'Starts in full screen. You can exit full screen or switch tabs without ending practice. Camera is optional.'}</p>
          <Button size="lg" icon={Maximize2} onClick={start} isLoading={isStarting}>{started ? 'Resume interview' : 'Start interview'}</Button>
          <p className="text-xs text-[#68645E] dark:text-[#9E988F]">{started ? 'Your original time limit still applies.' : 'The timer starts only when you begin.'}</p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
          <aside className="hidden lg:block space-y-4">
            <Card className="!p-4">
              <div className="flex items-center justify-between text-xs mb-4"><span className="font-semibold">Questions</span><span className="text-[#68645E] dark:text-[#9E988F]">{currentIndex + 1} of {questions.length}</span></div>
              <ol className="flex lg:flex-col gap-2 flex-wrap">
                {questions.map((question, index) => <li key={question._id} aria-current={index === currentIndex ? 'step' : undefined} className={'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ' + (index === currentIndex ? 'bg-[#FAF0F2] dark:bg-[#7A263A]/20 text-[#7A263A] dark:text-[#E8A5B2] font-semibold' : 'text-[#68645E] dark:text-[#9E988F]')}>
                  <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center shrink-0">{index < currentIndex || (index === currentIndex && evaluation) ? <Check className="w-3 h-3" /> : index + 1}</span><span className="hidden lg:inline">{question.topic}</span>
                </li>)}
              </ol>
            </Card>
            <Card className="!p-4 space-y-3">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold">Camera preview</span><button type="button" aria-label={cameraOn ? 'Turn off camera preview' : 'Turn on camera preview'} className="p-1.5 rounded-lg hover:bg-[#F0ECE4] dark:hover:bg-[#24201C]" onClick={toggleCamera}>{cameraOn ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}</button></div>
              {cameraOn && <video ref={video} autoPlay muted playsInline className="aspect-video w-full rounded-lg object-cover bg-[#24201C]" />}
              <p className="text-xs leading-relaxed text-[#68645E] dark:text-[#9E988F]">{cameraOn ? 'Preview only. Video is never recorded.' : 'Optional. Turn it on to check your framing.'}</p>
              {cameraError && <p role="alert" className="text-xs text-[#A33B3B]">{cameraError}</p>}
            </Card>
          </aside>
          <div className="space-y-5 min-w-0">
            {cameraOn && <video ref={(node) => { if (node && node.srcObject !== camera.current) attachStream(node, camera.current); }} autoPlay muted playsInline className="lg:hidden aspect-video max-w-sm w-full rounded-xl object-cover bg-[#24201C]" />}
            {cameraError && <p role="alert" className="lg:hidden text-xs text-[#A33B3B]">{cameraError}</p>}
            <Card className="!p-6 sm:!p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#7A263A] dark:text-[#D4AA6A] font-semibold">Question {currentIndex + 1} · {currentQuestion.topic}</p>
                {window.speechSynthesis && <button type="button" disabled={voiceBusy} onClick={readQuestion} aria-label={speaking ? 'Stop reading question' : 'Read question aloud'} className="inline-flex items-center gap-1.5 text-xs text-[#68645E] dark:text-[#9E988F] hover:underline">{speaking ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}{speaking ? 'Stop reading' : 'Read aloud'}</button>}
              </div>
              <h2 className="font-serif text-xl sm:text-2xl leading-snug font-semibold mt-5">{currentQuestion.questionText}</h2>
            </Card>
            {evaluation ? (
              <Card className="!p-6 sm:!p-8 space-y-6">
                <AnswerFeedback answer={evaluation} />
                <div className="flex justify-end"><Button icon={ArrowRight} onClick={next}>{sessionComplete ? 'View results' : 'Next question'}</Button></div>
              </Card>
            ) : (
              <Card className="!p-6 sm:!p-8 space-y-4">
                <div className="flex items-center justify-between gap-3"><label htmlFor="interview-answer" className="font-semibold text-sm">Your answer</label><span role="status" className="text-[11px] text-[#68645E] dark:text-[#9E988F]">{draftStatus}</span></div>
                <textarea id="interview-answer" value={answerText} onChange={(e) => updateAnswer(e.target.value)} disabled={isSubmitting || isFinishing} maxLength={20000} rows={11} placeholder="Explain your approach, then cover the details and trade-offs." className="mv-input !text-sm !leading-7 !p-4 min-h-[260px] resize-y" />
                <AudioAnswer key={currentQuestion._id} timeExpired={started && secondsLeft === 0} disabled={isSubmitting || isFinishing} onTranscript={(text) => updateAnswer((previous) => (previous.trimEnd() ? previous.trimEnd() + '\n\n' : '') + text, true)} onBusyChange={(value, status) => { voicePrompt.current = ['requesting', 'choosing'].includes(status); voiceActive.current = value; setVoiceBusy(value); if (value) setSpeaking(false); }} />
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                  <span className="text-xs text-[#68645E] dark:text-[#9E988F]">{wordCount} words · {answerText.length.toLocaleString()} / 20,000 characters</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" icon={SkipForward} disabled={locked} onClick={() => submit(true).catch(() => {})}>Skip</Button>
                    <Button icon={Send} isLoading={isSubmitting} disabled={locked || !answerText.trim()} onClick={() => submit().catch(() => {})}>{isSubmitting ? 'Saving answer…' : 'Submit answer'}</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
      {finishOpen && <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="finish-title">
        <Card className="max-w-md w-full !p-7 space-y-4"><h2 id="finish-title" className="font-serif text-2xl font-bold">Finish this interview?</h2><p className="text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">{answerText.trim() && !evaluation ? 'Your current answer will be submitted. ' : ''}You can review submitted answers and worked solutions afterwards.</p><div className="flex justify-end gap-2"><Button autoFocus variant="outline" onClick={() => setFinishOpen(false)}>Keep practicing</Button><Button onClick={() => finish()}>Finish interview</Button></div></Card>
      </div>}
    </div>
  );
};
const MicIcon = () => <Volume2 className="w-7 h-7 text-[#7A263A] dark:text-[#D4AA6A]" />;
