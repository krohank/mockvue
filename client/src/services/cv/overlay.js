import { FACE_CONNECTIONS } from './visionRuntime.js';
import { LANDMARK } from './geometry.js';

/**
 * Draws the vision HUD on a canvas that has the same intrinsic size as the
 * video and the same CSS (object-fit + mirroring), so coordinates line up
 * exactly. No text is drawn here — labels live in the DOM so they are not
 * mirrored and remain accessible.
 */
const COLORS = {
  ok: '#5FA57A',
  warn: '#E0A34A',
  alert: '#E06464',
  muted: 'rgba(255,255,255,0.35)',
};

const drawConnections = (ctx, lm, connections, w, h) => {
  if (!connections) return;
  ctx.beginPath();
  for (const { start, end } of connections) {
    const a = lm[start];
    const b = lm[end];
    if (!a || !b) continue;
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
  }
  ctx.stroke();
};

const drawCornerBox = (ctx, x, y, bw, bh, color, lineWidth) => {
  const c = Math.min(bw, bh) * 0.2;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
  ctx.moveTo(x + bw - c, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + c);
  ctx.moveTo(x, y + bh - c); ctx.lineTo(x, y + bh); ctx.lineTo(x + c, y + bh);
  ctx.moveTo(x + bw - c, y + bh); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw, y + bh - c);
  ctx.stroke();
};

export const clearOverlay = (canvas) => {
  const ctx = canvas?.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
};

export const drawOverlay = (canvas, frame, { showMesh = true } = {}) => {
  if (!canvas || !frame) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const scale = Math.max(1, w / 640);

  frame.faces.forEach((face, idx) => {
    const isPrimary = idx === 0 && frame.faces.length === 1;
    const color = !isPrimary ? COLORS.alert : face.attention?.away ? COLORS.warn : COLORS.ok;
    const lm = face.landmarks;

    if (showMesh && lm) {
      ctx.lineWidth = 1.2 * scale;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.85;
      drawConnections(ctx, lm, FACE_CONNECTIONS.oval, w, h);
      ctx.globalAlpha = 0.7;
      drawConnections(ctx, lm, FACE_CONNECTIONS.leftEye, w, h);
      drawConnections(ctx, lm, FACE_CONNECTIONS.rightEye, w, h);
      drawConnections(ctx, lm, FACE_CONNECTIONS.leftBrow, w, h);
      drawConnections(ctx, lm, FACE_CONNECTIONS.rightBrow, w, h);
      drawConnections(ctx, lm, FACE_CONNECTIONS.lips, w, h);
      ctx.globalAlpha = 1;

      // Irises
      ctx.fillStyle = color;
      for (const i of [LANDMARK.leftIris, LANDMARK.rightIris]) {
        const p = lm[i];
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 2.4 * scale, 0, Math.PI * 2);
        ctx.fill();
      }

      // Head direction ray from the nose tip
      const nose = lm[LANDMARK.noseTip];
      if (nose && face.pose) {
        const len = (face.box?.w || 0.2) * w * 0.55;
        // yaw>0 = candidate's left = raw image right (+x); pitch>0 = up (-y on canvas)
        const dx = Math.sin((face.pose.yaw * Math.PI) / 180) * len;
        const dy = -Math.sin((face.pose.pitch * Math.PI) / 180) * len;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.moveTo(nose.x * w, nose.y * h);
        ctx.lineTo(nose.x * w + dx, nose.y * h + dy);
        ctx.stroke();
      }
    }

    if (face.box) {
      const pad = 0.04;
      drawCornerBox(
        ctx,
        (face.box.x - pad * face.box.w) * w,
        (face.box.y - pad * face.box.h) * h,
        face.box.w * (1 + 2 * pad) * w,
        face.box.h * (1 + 2 * pad) * h,
        color,
        2.5 * scale
      );
    }
  });

  for (const obj of frame.objects || []) {
    if (obj.label !== 'cell phone') continue;
    const { x, y, w: bw, h: bh } = obj.box;
    ctx.strokeStyle = COLORS.alert;
    ctx.lineWidth = 3 * scale;
    ctx.setLineDash([8 * scale, 5 * scale]);
    ctx.strokeRect(x * w, y * h, bw * w, bh * h);
    ctx.setLineDash([]);
  }
};
