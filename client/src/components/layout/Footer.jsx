import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

export const Footer = () => (
  <footer className="no-print mt-auto border-t border-line bg-canvas">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
      <div className="flex flex-col gap-2">
        <Logo />
        <p className="text-sm text-ink-3">Mock interviews with rubric scoring and private, on-device proctoring.</p>
      </div>
      <div className="flex flex-col gap-3 text-sm text-ink-3 md:items-end">
        <p className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
          Camera frames are analysed in your browser and never uploaded.
        </p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link to="/#how-it-works" className="hover:text-ink">How it works</Link>
          <Link to="/#privacy" className="hover:text-ink">Privacy</Link>
          <span>© {new Date().getFullYear()} MockVue</span>
        </nav>
      </div>
    </div>
  </footer>
);
