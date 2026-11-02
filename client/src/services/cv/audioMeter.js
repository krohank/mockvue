/**
 * Microphone level meter using the Web Audio API. Reports a real dBFS value
 * (RMS of the time-domain signal), not an average of FFT bins.
 */
export const rmsToDb = (rms) => (rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100);

export const computeRms = (samples) => {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
};

/** Voice activity: clearly above the room's noise floor and above an absolute minimum. */
export const isVoice = (db, noiseFloorDb, policy) =>
  db > Math.max(policy.minVoiceDb, (noiseFloorDb ?? -60) + policy.voiceMarginDb);

export class AudioMeter {
  constructor(stream) {
    this.ctx = null;
    this.analyser = null;
    this.buffer = null;
    this.source = null;
    this.smoothedDb = -100;
    if (!stream || stream.getAudioTracks().length === 0) return;

    const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.buffer = new Float32Array(this.analyser.fftSize);
      this.source = this.ctx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);
      // Some browsers start suspended until a user gesture.
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (err) {
      console.warn('[AudioMeter] unavailable:', err.message);
      this.ctx = null;
      this.analyser = null;
    }
  }

  get available() {
    return Boolean(this.analyser);
  }

  /** Current level in dBFS, lightly smoothed (fast attack, slow release). */
  read() {
    if (!this.analyser) return null;
    this.analyser.getFloatTimeDomainData(this.buffer);
    const db = rmsToDb(computeRms(this.buffer));
    const alpha = db > this.smoothedDb ? 0.5 : 0.1;
    this.smoothedDb = this.smoothedDb + alpha * (db - this.smoothedDb);
    return this.smoothedDb;
  }

  close() {
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
  }
}
