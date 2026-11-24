export class AudioRecorder {
  constructor({ onLevel = () => {}, onError = () => {}, onInterrupted = () => {} } = {}) {
    this.onLevel = onLevel; this.onError = onError; this.onInterrupted = onInterrupted;
    this.stream = null; this.recorder = null; this.context = null; this.frame = null;
    this.cancelled = false; this.parts = [];
  }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error('Recording is unavailable in this browser. Upload an audio file or type your answer.');
    }
    this.cancelled = false;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    if (this.cancelled) { this.release(); return; }
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported?.(type));
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.result = new Promise((resolve, reject) => {
      this.recorder.ondataavailable = (event) => { if (event.data.size) this.parts.push(event.data); };
      this.recorder.onerror = () => {
        this.onError('Recording was interrupted. Please try again.');
        this.release(); reject(new Error('Recording was interrupted. Please try again.'));
      };
      this.recorder.onstop = () => {
        const blob = new Blob(this.parts, { type: this.recorder.mimeType || 'audio/webm' });
        this.release(); resolve(blob);
      };
    });
    this.result.catch(() => {});
    this.stream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        if (this.recorder?.state === 'recording') {
          this.onError('Your microphone disconnected. The recording was stopped.');
          this.stop().then((blob) => this.onInterrupted(blob)).catch(() => {});
        }
      };
    });
    this.recorder.start(1000);
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context) {
        this.context = new Context();
        const analyser = this.context.createAnalyser();
        analyser.fftSize = 256;
        this.context.createMediaStreamSource(this.stream).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!this.context) return;
          analyser.getByteTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, n) => sum + ((n - 128) / 128) ** 2, 0) / samples.length);
          this.onLevel(Math.min(100, Math.round(rms * 450)));
          this.frame = requestAnimationFrame(tick);
        };
        tick();
      }
    } catch { /* Recording remains available if audio metering is unsupported. */ }
  }
  stop() {
    if (!this.recorder) return Promise.reject(new Error('No recording is in progress.'));
    if (this.recorder.state === 'recording') this.recorder.stop();
    return this.result;
  }
  release() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
    if (this.stream) this.stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    this.stream = null;
    const context = this.context; this.context = null;
    if (context && context.state !== 'closed') context.close().catch(() => {});
    this.onLevel(0);
  }
  dispose() {
    this.cancelled = true;
    if (this.recorder?.state === 'recording') this.recorder.stop();
    this.release();
  }
}
export function microphoneError(error) {
  if (['NotAllowedError', 'PermissionDeniedError'].includes(error.name)) return 'Microphone access was blocked. Allow it in your browser settings, or upload an audio file.';
  if (error.name === 'NotFoundError') return 'No microphone was found. Connect one or upload an audio file.';
  if (error.name === 'NotReadableError') return 'Your microphone is busy in another app. Close that app and try again.';
  return error.message || 'Could not start recording. Please try again.';
}
