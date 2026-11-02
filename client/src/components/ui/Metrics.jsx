import React from 'react';
import { scoreBand } from '../../lib/format';

const TONE_TEXT = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-ink-3',
  accent: 'text-accent-ink',
};

const TONE_BAR = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-ink-3',
  accent: 'bg-accent-ink',
};

/** Circular score gauge. The band label is always printed — color is never the only signal. */
export const ScoreRing = ({ score, size = 132, stroke = 10, label = 'Overall score', showBand = true }) => {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const band = scoreBand(score);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${label}: ${score ?? 'not scored'} out of 100, ${band.label}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-3" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value / 100)}
            className={`transition-[stroke-dashoffset] duration-700 ease-out ${
              { success: 'stroke-success', warning: 'stroke-warning', danger: 'stroke-danger', neutral: 'stroke-ink-3' }[band.tone]
            }`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-[2rem] font-semibold leading-none text-ink" style={{ fontSize: size * 0.26 }}>
            {score ?? '—'}
          </span>
          <span className="mt-1 text-xs text-ink-3">of 100</span>
        </div>
      </div>
      {showBand && <span className={`mt-2 text-sm font-semibold ${TONE_TEXT[band.tone]}`}>{band.label}</span>}
    </div>
  );
};

/** Labelled horizontal meter: value / max, fill colored by band unless a tone is forced. */
export const Meter = ({ label, value, max = 100, tone, hint, compact = false, valueLabel }) => {
  const pct = max ? Math.max(0, Math.min(100, (Number(value) / max) * 100)) : 0;
  const resolvedTone = tone || scoreBand(pct).tone;
  return (
    <div>
      <div className={`flex items-baseline justify-between gap-3 ${compact ? 'mb-1' : 'mb-1.5'}`}>
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-ink`}>{label}</span>
        <span className={`num ${compact ? 'text-xs' : 'text-sm'} text-ink-2`}>
          {valueLabel ?? (
            <>
              {value ?? '—'}
              <span className="text-ink-3">/{max}</span>
            </>
          )}
        </span>
      </div>
      <div
        className={`${compact ? 'h-1.5' : 'h-2'} w-full overflow-hidden rounded-full bg-surface-3`}
        role="meter"
        aria-label={label}
        aria-valuenow={Number(value) || 0}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={`h-full rounded-full ${TONE_BAR[resolvedTone]} transition-[width] duration-700 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
};

/** Stat tile: label · value · optional sublabel. */
export const StatTile = ({ label, value, sub, icon: Icon, className = '' }) => (
  <div className={`card p-4 sm:p-5 ${className}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-ink-3">{label}</span>
      {Icon && <Icon className="h-4 w-4 text-ink-3" aria-hidden="true" />}
    </div>
    <p className="num mt-2 text-2xl font-semibold text-ink sm:text-[1.75rem]">{value}</p>
    {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
  </div>
);

export const ScorePill = ({ score }) => {
  const band = scoreBand(score);
  if (score === null || score === undefined) return <span className="num text-sm text-ink-3">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${TONE_BAR[band.tone]}`} aria-hidden="true" />
      <span className="num text-sm font-semibold text-ink">{score}</span>
      <span className="sr-only">{band.label}</span>
    </span>
  );
};
