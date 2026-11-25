import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, Video, ShieldCheck, Mic } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { AudioAnswer } from '../components/AudioAnswer';
import api from '../services/api';

export const InterviewPrepPage = () => {
  const { id } = useParams(), navigate = useNavigate();
  const [interview, setInterview] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [testTranscript, setTestTranscript] = useState(''), [voiceBusy, setVoiceBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false), [cameraError, setCameraError] = useState('');
  const [aiReady, setAiReady] = useState(null);
  const video = useRef(null), stream = useRef(null), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    api.get('/health', { signal: controller.signal }).then((r) => { if (!controller.signal.aborted) setAiReady(Boolean(r.ai?.available)); }).catch(() => {});
    api.get('/interviews/' + id, { signal: controller.signal }).then((res) => {
      if (!mounted.current) return;
      if (res.interview.status === 'in_progress') return navigate('/interviews/' + id + '/room', { replace: true });
      if (['completed', 'terminated'].includes(res.interview.status)) return navigate('/interviews/' + id + '/results', { replace: true });
      setInterview(res.interview);
    }).catch((err) => { if (err.code !== 'ERR_CANCELED' && mounted.current) setError(err.message); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; controller.abort(); stream.current?.getTracks().forEach((track) => track.stop()); };
  }, [id, navigate]);
  useEffect(() => { if (video.current && stream.current) video.current.srcObject = stream.current; }, [cameraOn]);
  const cameraTest = async () => {
    if (cameraOn) { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setCameraOn(false); return; }
    setCameraError('');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!mounted.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; setCameraOn(true);
    } catch { setCameraError('Camera unavailable. You can still practice and record voice answers.'); }
  };
  if (loading) return <div className="min-h-[70vh] flex items-center justify-center"><Spinner label="Loading setup…" /></div>;
  if (!interview) return <div className="max-w-xl mx-auto py-20 px-5 space-y-4"><h1 className="text-3xl font-serif font-bold">Interview unavailable</h1><p role="alert">{error}</p><Link to="/dashboard"><Button>Back to dashboard</Button></Link></div>;
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-8">
      <div><p className="text-sm text-[#7A263A] dark:text-[#D4AA6A] mb-3">Before you begin</p><h1 className="text-3xl sm:text-4xl font-serif font-bold">Check your setup</h1><p className="mt-3 text-sm text-[#68645E] dark:text-[#9E988F]">Test your microphone, review the format, then start when you’re ready.</p></div>
      <Card className="flex flex-wrap items-center justify-between gap-5">
        <div><h2 className="font-serif text-xl font-semibold">{interview.targetRole}</h2><div className="mt-3 flex flex-wrap gap-2"><Badge>{interview.difficulty}</Badge><Badge>{interview.questions.length} questions</Badge><Badge>{interview.durationMinutes} minutes</Badge><Badge variant="brand">{interview.mode === 'assessment' ? 'Assessment' : 'Practice'}</Badge></div></div>
        <span className="text-xs text-[#68645E] dark:text-[#9E988F]">{interview.isFallbackAI ? 'Question bank' : interview.questionProvider === 'local' ? 'Local AI questions' : 'AI questions'}</span>
      </Card>
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-5">
          <Card className="space-y-5">
            <h2 className="font-serif text-xl font-semibold flex items-center gap-2"><Mic className="w-5 h-5 text-[#7A263A]" />Try a voice answer</h2>
            <p className="text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">Say a sentence, stop the recording, and check the transcript. This test won’t be submitted as an answer.</p>
            <AudioAnswer recordLabel="Test microphone" onTranscript={setTestTranscript} onBusyChange={setVoiceBusy} />
            {testTranscript && <div className="rounded-xl border border-[#C2D9CB] dark:border-[#3F6B52]/40 bg-[#EFF5F1] dark:bg-[#3F6B52]/10 p-4"><p className="text-xs text-[#3F6B52] dark:text-[#88BA9D] flex gap-1.5 items-center font-semibold mb-2"><Check className="w-4 h-4" />Transcription worked</p><p className="text-sm leading-relaxed">{testTranscript}</p></div>}
          </Card>
          <Card className="space-y-4">
            <div className="flex justify-between items-center"><h2 className="font-serif text-xl font-semibold">Camera preview</h2><Button size="sm" icon={Video} variant="outline" onClick={cameraTest}>{cameraOn ? 'Turn off' : 'Test camera'}</Button></div>
            {cameraOn && <video ref={video} autoPlay muted playsInline className="aspect-video w-full rounded-xl object-cover bg-[#24201C]" />}
            <p className="text-xs leading-relaxed text-[#68645E] dark:text-[#9E988F]">Optional. Video stays in your browser and is never recorded or used to score your answers.</p>
            {cameraError && <p role="alert" className="text-xs text-[#A33B3B]">{cameraError}</p>}
          </Card>
        </div>
        <Card className="space-y-6">
          <h2 className="font-serif text-xl font-semibold">What to expect</h2>
          <ul className="space-y-4 text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">
            <li className="flex gap-3"><Check className="w-4 h-4 shrink-0 text-[#3F6B52] mt-1" />Answer one question at a time. You can type, record, or upload an audio clip.</li>
            <li className="flex gap-3"><Check className="w-4 h-4 shrink-0 text-[#3F6B52] mt-1" />Review and edit each transcript before submitting. Drafts save on this device.</li>
            <li className="flex gap-3"><Check className="w-4 h-4 shrink-0 text-[#3F6B52] mt-1" />{'Each answer is scored by a local rubric checker (no AI model) that compares your wording with the saved answer: accuracy, relevance, completeness and clarity, plus the key points you covered or missed.'}</li>
          </ul>
          <div className="rounded-xl border border-[#DED9D0] dark:border-[#332F2A] p-4 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4" />{interview.mode === 'assessment' ? 'Assessment rules' : 'Practice mode'}</p>
            <p className="text-xs leading-relaxed text-[#68645E] dark:text-[#9E988F]">{interview.mode === 'assessment' ? 'Full screen is required. Leaving full screen or switching tabs ends the assessment. Microphone permission prompts are allowed.' : 'The interview starts in full screen. You can exit full screen or switch tabs and return to your saved draft. Camera is optional.'}</p>
          </div>
          {interview.generationNotice && <p className="text-xs leading-relaxed text-[#68645E] dark:text-[#9E988F]">{interview.generationNotice}</p>}
          <Button size="lg" icon={ArrowRight} className="w-full" disabled={voiceBusy} onClick={() => navigate('/interviews/' + id + '/room')}>Continue to interview</Button>
          <p className="text-center text-xs text-[#68645E] dark:text-[#9E988F]">The timer hasn’t started yet.</p>
        </Card>
      </div>
    </div>
  );
};
