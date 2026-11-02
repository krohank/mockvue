import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };
const TONES = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  info: 'text-accent-ink',
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message, { tone = 'info', title, duration = 4500 } = {}) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((list) => [...list.slice(-3), { id, message, tone, title }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (m, o) => show(m, { ...o, tone: 'success' }),
      error: (m, o) => show(m, { ...o, tone: 'error', duration: o?.duration ?? 6500 }),
      warning: (m, o) => show(m, { ...o, tone: 'warning' }),
      info: (m, o) => show(m, { ...o, tone: 'info' }),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.tone] || Info;
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-raised animate-slide-up"
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${TONES[t.tone]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm">
                {t.title && <p className="font-semibold text-ink">{t.title}</p>}
                <p className="text-ink-2">{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
