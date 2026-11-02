/**
 * Minimal presence estimator used only when MediaPipe cannot run on the
 * device (no WebAssembly/WebGL, blocked CDN, very old browser). It looks for a
 * skin-toned region near the centre of the frame. It is deliberately
 * conservative: it never estimates gaze or counts people.
 */
export const skinRatio = (rgba, width, height) => {
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.1);
  const y1 = Math.ceil(height * 0.85);
  let skin = 0;
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > 40) skin += 1;
      total += 1;
    }
  }
  return total ? skin / total : 0;
};

export const meanLuma = (rgba) => {
  let sum = 0;
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  return n ? sum / n : 0;
};

export class FrameSampler {
  constructor(width = 64, height = 48) {
    this.width = width;
    this.height = height;
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }
  }

  sample(video) {
    if (!this.ctx) return null;
    this.ctx.drawImage(video, 0, 0, this.width, this.height);
    return this.ctx.getImageData(0, 0, this.width, this.height).data;
  }
}
