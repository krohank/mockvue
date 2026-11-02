import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Field = ({ label, hint, error, children, className = '', htmlFor, optional }) => (
  <div className={className}>
    {label && (
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-3">Optional</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="mt-1.5 text-xs text-danger" role="alert">
        {error}
      </p>
    ) : (
      hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>
    )}
  </div>
);

export const Input = forwardRef(function Input({ icon: Icon, className = '', ...props }, ref) {
  if (!Icon) return <input ref={ref} className={`field-input ${className}`} {...props} />;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      <input ref={ref} className={`field-input pl-10 ${className}`} {...props} />
    </div>
  );
});

export const PasswordInput = forwardRef(function PasswordInput({ icon: Icon, className = '', ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
      )}
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`field-input pr-11 ${Icon ? 'pl-10' : ''} ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

export const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <select ref={ref} className={`field-input cursor-pointer appearance-none bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10 ${className}`}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23857F77' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`field-input min-h-[96px] resize-y leading-relaxed ${className}`} {...props} />;
});

export const useFieldId = (prefix = 'field') => `${prefix}-${useId().replace(/:/g, '')}`;

/** Toggleable pill used for multi-select topic pickers. */
export const Chip = ({ selected, onClick, children, disabled, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={selected}
    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${
      selected
        ? 'border-accent bg-accent text-accent-fg shadow-card'
        : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
    } ${className}`}
  >
    {children}
  </button>
);

/** Large single-select option card (radio semantics). */
export const ChoiceCard = ({ selected, onClick, title, description, meta, className = '' }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onClick}
    className={`group relative w-full rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 ${
      selected
        ? 'border-accent-ink/60 bg-accent-soft shadow-card ring-1 ring-accent-ink/30'
        : 'border-line bg-surface hover:border-line-strong'
    } ${className}`}
  >
    <span className="flex items-start justify-between gap-3">
      <span className="text-sm font-semibold text-ink">{title}</span>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          selected ? 'border-accent-ink bg-accent-ink' : 'border-line-strong'
        }`}
        aria-hidden="true"
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-surface" />}
      </span>
    </span>
    {description && <span className="mt-1 block text-[13px] leading-snug text-ink-3">{description}</span>}
    {meta && <span className="mt-2 block text-xs text-ink-3">{meta}</span>}
  </button>
);
