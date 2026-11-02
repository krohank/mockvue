import React from 'react';

const TONES = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  accent: 'bg-accent-soft text-accent-ink border-accent-ink/20',
  brass: 'bg-brass-soft text-brass border-brass/25',
  success: 'bg-success-soft text-success border-success/25',
  warning: 'bg-warning-soft text-warning border-warning/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
};

const DOTS = {
  neutral: 'bg-ink-3',
  accent: 'bg-accent-ink',
  brass: 'bg-brass',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export const Badge = ({ tone = 'neutral', dot = false, icon: Icon, size = 'md', className = '', children }) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
    } ${TONES[tone] || TONES.neutral} ${className}`}
  >
    {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone] || DOTS.neutral}`} aria-hidden="true" />}
    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
    {children}
  </span>
);
