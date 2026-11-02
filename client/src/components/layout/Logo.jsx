import React from 'react';
import { Link } from 'react-router-dom';

export const LogoMark = ({ className = 'h-8 w-8' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="8" className="fill-accent" />
    <path d="M8 22V10.5l8 7 8-7V22" fill="none" stroke="#F7F4EE" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16" cy="25" r="1.6" fill="#D9B26F" />
  </svg>
);

export const Logo = ({ to = '/', compact = false }) => (
  <Link to={to} className="group inline-flex items-center gap-2.5 rounded-lg" aria-label="MockVue home">
    <LogoMark className="h-8 w-8 transition-transform duration-200 group-hover:-rotate-6" />
    {!compact && <span className="font-serif text-xl font-semibold tracking-tight text-ink">MockVue</span>}
  </Link>
);
