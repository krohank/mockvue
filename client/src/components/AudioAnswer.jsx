import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Upload, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { AudioRecorder, microphoneError } from '../services/audioRecorder';
import api from '../services/api';

export const AudioAnswer = ({ onTranscript, onBusyChange, disabled = false, recordLabel = 'Record answer', timeExpired = false }) => {
  const [status, setStatus] = useState('idle');
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [language, setLanguage] = useState('en');
  const [lastAudio, setLastAudio] = useState(null);
  const recorder = useRef(null), mounted = useRef(true), inFlight = useRef(false), abort = useRef(null), fileInput = useRef(null);
  const transcriptRef = useRef(onTranscript), busyRef = useRef(onBusyChange);
  transcriptRef.current = onTranscript; busyRef.current = onBusyChange;
  const busy = ['choosing', 'requesting', 'recording', 'transcribing'].includes(status);

  useEffect(() => { busyRef.current?.(busy, status); }, [busy, status]);
  useEffect(() => {
    const input = fileInput.current;
    const cancel = () => { setStatus('idle'); busyRef.current?.(false, 'idle'); };
    input?.addEventListener('cancel', cancel);
    return () => input?.removeEventListener('cancel', cancel);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; recorder.current?.dispose(); abort.current?.abort(); busyRef.current?.(false); };
  }, []);
  useEffect(() => {
    if (status !== 'recording') return;
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [status]);
  useEffect(() => { if (status === 'recording' && seconds >= 295) stop(); }, [seconds, status]);
  useEffect(() => { if (timeExpired && status === 'recording') stop(); }, [timeExpired, status]);

  const transcribe = async (blob) => {
    busyRef.current?.(true, 'transcribing');
    setLastAudio(blob); setStatus('transcribing'); setError(''); setNotice('');
    abort.current = new AbortController();
    try {
      const result = await api.post('/speech/transcribe?language=' + language, blob, {
        headers: { 'Content-Type': blob.type || 'application/octet-stream' }, timeout: 120000, signal: abort.current.signal,
      });
      if (!mounted.current) return;
      if (!result.text?.trim()) throw new Error('No speech was detected. Please try again.');
      transcriptRef.current(result.text.trim());
      setStatus('idle'); setLastAudio(null);
      setNotice('Transcript added to your answer. Review it before submitting.');
    } catch (err) {
      if (mounted.current && err.code !== 'ERR_CANCELED') {
        setError(err.message || 'Transcription failed. Your answer has not changed.'); setStatus('error');
      }
    }
  };
  const start = async () => {
    if (inFlight.current || busy || disabled) return;
    inFlight.current = true; setError(''); setNotice(''); setStatus('requesting'); setSeconds(0);
    busyRef.current?.(true, 'requesting');
    window.speechSynthesis?.cancel();
    recorder.current = new AudioRecorder({
      onLevel: (value) => { if (mounted.current) setLevel(value); },
      onError: (message) => { if (mounted.current) { setError(message); setStatus('error'); } },
      onInterrupted: (blob) => { if (mounted.current) { setLastAudio(blob); setStatus('error'); } },
    });
    try {
      await recorder.current.start();
      if (mounted.current) setStatus('recording');
    } catch (err) {
      recorder.current?.dispose();
      if (mounted.current) { setError(microphoneError(err)); setStatus('error'); }
    } finally { inFlight.current = false; }
  };
  const stop = async () => {
    if (inFlight.current || status !== 'recording') return;
    inFlight.current = true;
    try {
      const blob = await recorder.current.stop();
      if (mounted.current) await transcribe(blob);
    } catch (err) { if (mounted.current) { setError(err.message); setStatus('error'); } }
    finally { inFlight.current = false; }
  };
  const upload = async (event) => {
    const blob = event.target.files?.[0]; event.target.value = '';
    if (!blob) { setStatus('idle'); return; }
    if (blob.size > 15 * 1024 * 1024) { setStatus('error'); setError('Choose a recording smaller than 15 MB and shorter than five minutes.'); return; }
    if (inFlight.current || (busy && status !== 'choosing') || disabled) return;
    inFlight.current = true;
    try { await transcribe(blob); } finally { inFlight.current = false; }
  };
  return (
    <div className="rounded-xl border border-[#DED9D0] dark:border-[#332F2A] bg-[#F7F4EE] dark:bg-[#141210] p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === 'recording' ? (
          <Button type="button" size="sm" variant="danger" icon={Square} onClick={stop}>Stop and transcribe · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" icon={Mic} onClick={start} disabled={disabled || busy || timeExpired} isLoading={status === 'requesting'}>{recordLabel}</Button>
        )}
        <Button type="button" size="sm" variant="ghost" icon={Upload} disabled={disabled || busy || timeExpired} onClick={() => { busyRef.current?.(true, 'choosing'); setStatus('choosing'); fileInput.current?.click(); }}>Upload audio</Button>
        <input ref={fileInput} type="file" accept="audio/*,.webm,.mp4" aria-label="Upload an audio answer" className="sr-only" onChange={upload} disabled={disabled || (busy && status !== 'choosing')} />
        <select aria-label="Spoken language" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={busy} className="mv-input !w-auto !py-1.5 !text-xs ml-auto">
          <option value="en">English</option><option value="hi">Hindi</option><option value="auto">Detect language</option>
        </select>
      </div>
      {status === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#A33B3B] animate-pulse" />
          <span className="text-xs text-[#68645E] dark:text-[#9E988F]">Listening</span>
          <div className="flex-1 h-1.5 rounded-full bg-[#DED9D0] dark:bg-[#332F2A]" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level}>
            <div className="h-full rounded-full bg-[#3F6B52] transition-[width]" style={{ width: level + '%' }} />
          </div>
        </div>
      )}
      <div aria-live="polite" className="text-xs leading-relaxed text-[#68645E] dark:text-[#9E988F]">
        {status === 'requesting' ? 'Allow microphone access when your browser asks.' : status === 'transcribing' ? (
          <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Transcribing your recording… You can keep editing your answer.</span>
        ) : notice || 'Record, stop, then review the transcript. Audio is processed locally and deleted after transcription.'}
      </div>
      {error && <p role="alert" className="text-xs text-[#A33B3B] dark:text-[#E59797]">{error}</p>}
      {status === 'error' && lastAudio && <Button size="sm" type="button" variant="outline" icon={RotateCcw} onClick={async () => { if (inFlight.current) return; inFlight.current = true; try { await transcribe(lastAudio); } finally { inFlight.current = false; } }}>Retry transcription</Button>}
    </div>
  );
};
