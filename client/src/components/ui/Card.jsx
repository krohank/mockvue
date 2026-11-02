import React from 'react';

export const Card = ({ as: Component = 'div', className = '', interactive = false, padded = true, children, ...props }) => (
  <Component className={`${interactive ? 'card-interactive' : 'card'} ${padded ? 'p-5 sm:p-6' : ''} ${className}`} {...props}>
    {children}
  </Component>
);

export const CardHeader = ({ title, description, action, icon: Icon, className = '', titleAs: Title = 'h2' }) => (
  <div className={`mb-5 flex items-start justify-between gap-4 ${className}`}>
    <div className="flex min-w-0 items-start gap-3">
      {Icon && (
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <Title className="text-base font-semibold text-ink">{title}</Title>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
