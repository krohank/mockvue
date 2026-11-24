import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => (
  <footer className="w-full mt-auto border-t border-[#DED9D0] dark:border-[#332F2A] bg-[#F7F4EE] dark:bg-[#141210]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Link to="/" className="font-serif font-bold text-[#171717] dark:text-[#F7F4EE]">MockVue</Link>
        <p className="text-xs text-[#68645E] dark:text-[#9E988F]">Technical interview practice.</p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-5 text-xs text-[#68645E] dark:text-[#9E988F]">
        <a href="/#how-it-works" className="hover:underline">How it works</a>
        <a href="/#feedback" className="hover:underline">Scoring</a>
        <a href="/#topics" className="hover:underline">Topics</a>
      </nav>
    </div>
  </footer>
);
