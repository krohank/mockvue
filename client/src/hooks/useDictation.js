import { useCallback, useEffect, useRef, useState } from 'react';

const getRecognition = () => (typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null);

export const dictationSupported = () => Boolean(getRecognition());

/**
 * Speech-to-text via the Web Speech API.
 * Final phrases are delivered once through `onFinal`; in-progress words are
 * exposed as `interim` for display only, so nothing is ever appended twice.
 * Chrome stops recognition after a pause — we restart while the user still
 * wants to dictate.
 */
export const useDictation = ({ onFinal, lang = 'en-US' } = {}) => {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const wantRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const supported = dictationSupported();

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const createRecognition = useCallback(() => {
    const Recognition = getRecognition();
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          if (text.trim()) onFinalRef.current?.(text.trim(), result[0]?.confidence);
        } else {
          pending += text;
        }
      }
      setInterim(pending.trim());
    };

    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      wantRef.current = false;
      setError(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone access for dictation was blocked.'
          : event.error === 'network'
            ? 'Dictation needs an internet connection in this browser.'
            : `Dictation stopped (${event.error}).`
      );
    };

    rec.onend = () => {
      setInterim('');
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through */
        }
      }
      setListening(false);
    };
    return rec;
  }, [lang]);

  const start = useCallback(() => {
    if (!supported || wantRef.current) return;
    setError('');
    wantRef.current = true;
    try {
      recRef.current = createRecognition();
      recRef.current.start();
      setListening(true);
    } catch (err) {
      wantRef.current = false;
      setError(err.message || 'Could not start dictation.');
      setListening(false);
    }
  }, [supported, createRecognition]);

  const stop = useCallback(() => {
    wantRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
    setInterim('');
  }, []);

  useEffect(
    () => () => {
      wantRef.current = false;
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    []
  );

  return { supported, listening, interim, error, start, stop, toggle: listening ? stop : start };
};
