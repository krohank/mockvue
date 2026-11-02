import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';

export const Spinner = ({ className = 'h-5 w-5', label }) => (
  <span className="inline-flex items-center gap-2 text-sm text-ink-3" role="status">
    <Loader2 className={`animate-spin text-accent-ink ${className}`} aria-hidden="true" />
    {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
  </span>
);

export const Skeleton = ({ className = 'h-4 w-full' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

export const PageLoader = ({ label = 'Loading…' }) => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Spinner className="h-6 w-6" label={label} />
  </div>
);

const ALERT_TONES = {
  info: { cls: 'bg-accent-soft border-accent-ink/20 text-ink', icon: Info, iconCls: 'text-accent-ink' },
  success: { cls: 'bg-success-soft border-success/25 text-ink', icon: CheckCircle2, iconCls: 'text-success' },
  warning: { cls: 'bg-warning-soft border-warning/25 text-ink', icon: AlertTriangle, iconCls: 'text-warning' },
  danger: { cls: 'bg-danger-soft border-danger/25 text-ink', icon: AlertCircle, iconCls: 'text-danger' },
};

export const Alert = ({ tone = 'info', title, children, action, className = '', icon }) => {
  const t = ALERT_TONES[tone] || ALERT_TONES.info;
  const Icon = icon || t.icon;
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${t.cls} ${className}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.iconCls}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={`text-ink-2 ${title ? 'mt-0.5' : ''}`}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
    {Icon && (
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
    )}
    <h3 className="text-base font-semibold text-ink">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-ink-3">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ title = 'Something went wrong', message, onRetry, action }) => (
  <div className="mx-auto max-w-md py-16">
    <Alert tone="danger" title={title}>
      <p>{message || 'Please try again.'}</p>
      {(onRetry || action) && (
        <div className="mt-3 flex gap-2">
          {onRetry && (
            <button type="button" onClick={onRetry} className="link text-sm">
              Try again
            </button>
          )}
          {action}
        </div>
      )}
    </Alert>
  </div>
);
