import React from 'react';

export const PageHeader = ({ eyebrow, title, description, actions, className = '' }) => (
  <header className={`flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between ${className}`}>
    <div className="min-w-0">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="display text-3xl sm:text-[2.25rem] leading-tight">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>
);

export const PageContainer = ({ children, size = 'xl', className = '' }) => (
  <div
    className={`mx-auto w-full px-4 py-8 sm:px-6 sm:py-10 lg:px-8 ${
      { md: 'max-w-3xl', lg: 'max-w-5xl', xl: 'max-w-6xl', full: 'max-w-7xl' }[size]
    } ${className}`}
  >
    {children}
  </div>
);
