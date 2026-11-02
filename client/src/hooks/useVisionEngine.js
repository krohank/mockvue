import { useEffect, useRef, useState } from 'react';
import { ProctoringEngine } from '../services/cv/ProctoringEngine';

/** Small, render-friendly snapshot of a vision frame. */
const summarize = (f) => ({
  mode: f.mode,
  capabilities: f.capabilities,
  faceCount: f.faceCount,
  away: Boolean(f.attention?.away),
  direction: f.attention?.direction || null,
  yaw: f.primary?.pose ? Math.round(f.primary.pose.yaw) : null,
  pitch: f.primary?.pose ? Math.round(f.primary.pose.pitch) : null,
  framing: f.framing,
  persons: f.persons,
  phone: f.phone,
  audioDb: f.audioDb === null ? null : Math.round(f.audioDb),
  voice: f.voice,
  lowLight: f.lowLight,
  perf: f.perf,
});

/**
 * Runs the on-device ProctoringEngine against a <video> element fed by `stream`.
 * Pass elements (not ref objects) so the engine restarts if the element changes.
 * `onFrame` receives every analysed frame (for the rules engine); React state
 * (`live`) is updated at most ~6×/s to keep re-renders cheap.
 */
export const useVisionEngine = ({ video, canvas, stream, enabled = true, baseline, noiseFloorDb, onFrame, showMesh = true }) => {
  const engineRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const lastUiRef = useRef(0);
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [live, setLive] = useState(null);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!enabled || !stream || !video) return undefined;
    let cancelled = false;
    const engine = new ProctoringEngine({
      video,
      canvas: canvas || null,
      baseline,
      noiseFloorDb,
      showMesh,
      onStatus: (s) => !cancelled && setStatus(s),
      onFrame: (frame) => {
        if (cancelled) return;
        onFrameRef.current?.(frame);
        if (frame.t - lastUiRef.current > 160) {
          lastUiRef.current = frame.t;
          setLive(summarize(frame));
        }
      },
    });
    engineRef.current = engine;
    engine.attachStream(stream);
    engine.init().then(() => {
      if (!cancelled) engine.start();
    });

    return () => {
      cancelled = true;
      engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
    // Baseline/noise floor changes are pushed imperatively below; don't restart the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, stream, video, canvas, showMesh]);

  useEffect(() => {
    if (baseline) engineRef.current?.setBaseline(baseline);
  }, [baseline]);

  useEffect(() => {
    if (noiseFloorDb !== undefined && noiseFloorDb !== null) engineRef.current?.setNoiseFloor(noiseFloorDb);
  }, [noiseFloorDb]);

  return { engineRef, status, live };
};
