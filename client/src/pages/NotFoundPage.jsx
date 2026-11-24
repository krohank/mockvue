import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 font-sans animate-fade-in">
      <div className="w-12 h-12 rounded-[10px] bg-[#7A263A] text-[#FFFDF9] flex items-center justify-center mb-4 shadow-paper border border-[#641F30]">
        <Terminal className="w-6 h-6" />
      </div>
      <span className="font-mono text-xs text-[#7A263A] dark:text-[#D4AA6A] uppercase tracking-wider font-semibold mb-1">
        ERROR CODE 404
      </span>
      <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#171717] dark:text-[#F7F4EE] mb-2 tracking-tight">
        Page not found
      </h1>
      <p className="text-xs sm:text-sm text-[#68645E] dark:text-[#9E988F] max-w-sm mb-6 leading-relaxed">
        This page does not exist or has moved.
      </p>
      <Link to="/">
        <Button icon={ArrowLeft} size="sm">
          Go to homepage
        </Button>
      </Link>
    </div>
  );
};

export default NotFoundPage;
