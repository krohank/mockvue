import { useCallback, useEffect, useRef, useState } from 'react';

const describeError = (err) => {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera or microphone permission was blocked. Allow access in your browser’s site settings, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Connect a webcam and try again.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Your camera is busy — close other apps or tabs that are using it, then try again.';
    default:
      return err?.message || 'Could not start the camera.';
  }
};

/**
 * Owns a camera + microphone MediaStream. Stops every track on unmount.
 * Audio is optional: if the mic is unavailable we retry with video only.
 */
export const useCamera = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [state, setState] = useState('idle'); // idle | requesting | active | error | ended
  const streamRef = useRef(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access a camera. Use a recent version of Chrome, Edge, Firefox or Safari over HTTPS.');
      setState('error');
      return null;
    }
    setState('requesting');
    setError('');
    const video = { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 30 } };
    let next;
    try {
      next = await navigator.mediaDevices.getUserMedia({ video, audio: { echoCancellation: true, noiseSuppression: false } });
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setError(describeError(err));
        setState('error');
        return null;
      }
      try {
        next = await navigator.mediaDevices.getUserMedia({ video });
      } catch (err2) {
        setError(describeError(err2));
        setState('error');
        return null;
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = next;
    next.getVideoTracks().forEach((track) => {
      track.onended = () => {
        if (streamRef.current === next) setState('ended');
      };
    });
    setStream(next);
    setState('active');
    return next;
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return {
    stream,
    state,
    error,
    hasAudio: Boolean(stream?.getAudioTracks().length),
    start,
    stop,
  };
};

/** Binds a MediaStream to a <video> element (re-binds if the element changes). */
export const useVideoStream = (video, stream) => {
  useEffect(() => {
    if (!video) return;
    if (video.srcObject !== (stream || null)) video.srcObject = stream || null;
    if (stream) video.play().catch(() => {});
  }, [video, stream]);
};
