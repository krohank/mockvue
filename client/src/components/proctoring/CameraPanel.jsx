import React from 'react';
import { Camera, CameraOff, Loader2, ScanFace, Eye, Users, Smartphone, Mic, Sun, Cpu, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

const DIRECTION_LABEL = { left: 'to your left', right: 'to your right', up: 'up', down: 'down' };

/**
 * Live camera with the vision overlay. The <video> and <canvas> share the same
 * intrinsic size, object-fit and mirroring, so landmarks line up exactly.
 */
export const CameraView = ({ videoRef, canvasRef, cameraState, cameraError, onStart, status, live, children, className = '' }) => {
  const hasStream = cameraState === 'active';
  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#141210] ${className}`}>
      <video ref={videoRef} autoPlay playsInline muted className={`mirror absolute inset-0 h-full w-full object-cover ${hasStream ? '' : 'invisible'}`} />
      <canvas ref={canvasRef} className={`mirror pointer-events-none absolute inset-0 h-full w-full object-cover ${hasStream ? '' : 'invisible'}`} aria-hidden="true" />

      {!hasStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
          {cameraState === 'requesting' ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
              <p className="text-sm">Waiting for camera permission…</p>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                {cameraState === 'error' || cameraState === 'ended' ? <CameraOff className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
              </span>
              <p className="max-w-xs text-sm">
                {cameraState === 'ended' ? 'The camera was disconnected.' : cameraError || 'Your camera is off.'}
              </p>
              {onStart && (
                <Button size="sm" variant="secondary" icon={cameraState === 'idle' ? Camera : RefreshCw} onClick={onStart}>
                  {cameraState === 'idle' ? 'Turn on camera' : 'Try again'}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {hasStream && status && (
        <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          {status.state === 'loading' ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> {status.message || 'Loading vision…'}
            </>
          ) : status.state === 'ready' ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#5FA57A]" aria-hidden="true" />
              On-device vision{live?.perf?.fps ? ` · ${live.perf.fps} fps` : ''}
            </>
          ) : status.state === 'basic' ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[#E0A34A]" aria-hidden="true" /> Basic detection
            </>
          ) : null}
        </div>
      )}
      {hasStream && live?.framing?.hint && status?.state === 'ready' && (
        <div className="absolute inset-x-2 bottom-2 rounded-md bg-black/60 px-2 py-1 text-center text-xs text-white backdrop-blur-sm" role="status">
          {live.framing.hint}
        </div>
      )}
      {children}
    </div>
  );
};

const Row = ({ icon: Icon, label, value, tone = 'ok' }) => (
  <div className="flex items-center justify-between gap-3 py-2">
    <span className="flex items-center gap-2 text-sm text-ink-2">
      <Icon className="h-4 w-4 text-ink-3" aria-hidden="true" />
      {label}
    </span>
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
        { ok: 'text-success', warn: 'text-warning', bad: 'text-danger', muted: 'text-ink-3' }[tone]
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${{ ok: 'bg-success', warn: 'bg-warning', bad: 'bg-danger', muted: 'bg-ink-3' }[tone]}`}
        aria-hidden="true"
      />
      {value}
    </span>
  </div>
);

/** Mic level from dBFS (-60..0) to a 0..100 bar. */
export const MicLevel = ({ db, voice }) => {
  const pct = db === null || db === undefined ? 0 : Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  return (
    <div className="flex items-center gap-2" aria-label={`Microphone level ${db ?? 'unavailable'} dB`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full transition-[width] duration-150 ${voice ? 'bg-success' : 'bg-ink-3'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="num w-14 text-right text-xs text-ink-3">{db === null || db === undefined ? '—' : `${db} dB`}</span>
    </div>
  );
};

/** Human-readable live readings from the vision engine. */
export const VisionReadout = ({ live, status, hasAudio }) => {
  if (!live || status?.state === 'loading') {
    return <p className="py-3 text-sm text-ink-3">{status?.message || 'Starting vision…'}</p>;
  }
  const caps = live.capabilities || {};
  const faces = live.faceCount;
  return (
    <div className="divide-y divide-line">
      <Row
        icon={ScanFace}
        label="Face"
        value={faces === null ? 'Checking' : faces === 0 ? 'Not detected' : faces === 1 ? 'Detected' : `${faces} faces`}
        tone={faces === null ? 'muted' : faces === 1 ? 'ok' : 'bad'}
      />
      {caps.attention && (
        <Row
          icon={Eye}
          label="Attention"
          value={faces !== 1 ? '—' : live.away ? `Looking ${DIRECTION_LABEL[live.direction] || 'away'}` : 'On screen'}
          tone={faces !== 1 ? 'muted' : live.away ? 'warn' : 'ok'}
        />
      )}
      {caps.objects && (
        <>
          <Row
            icon={Users}
            label="People in view"
            value={live.persons === null ? 'Checking' : String(Math.max(live.persons, faces || 0))}
            tone={live.persons === null ? 'muted' : Math.max(live.persons, faces || 0) <= 1 ? 'ok' : 'bad'}
          />
          <Row icon={Smartphone} label="Phone" value={live.phone === null ? 'Checking' : live.phone ? 'Detected' : 'None'} tone={live.phone ? 'bad' : live.phone === null ? 'muted' : 'ok'} />
        </>
      )}
      <Row icon={Sun} label="Lighting" value={live.lowLight ? 'Too dark' : 'Good'} tone={live.lowLight ? 'warn' : 'ok'} />
      <div className="flex items-center justify-between gap-3 py-2">
        <span className="flex items-center gap-2 text-sm text-ink-2">
          <Mic className="h-4 w-4 text-ink-3" aria-hidden="true" />
          Microphone
        </span>
        {hasAudio ? <MicLevel db={live.audioDb} voice={live.voice} /> : <span className="text-sm text-ink-3">Not available</span>}
      </div>
      {live.perf?.delegate && (
        <Row icon={Cpu} label="Processing" value={`${live.perf.delegate} · ${live.perf.inferenceMs ?? '—'} ms`} tone="muted" />
      )}
    </div>
  );
};
