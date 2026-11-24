import React from 'react';
import { Button } from './ui/Button';
export const PageError = ({ title = 'This page couldn’t load', message }) => (
  <div className="max-w-lg mx-auto px-5 py-20 space-y-5">
    <h1 className="font-serif text-3xl font-bold">{title}</h1>
    <p role="alert" className="text-sm leading-relaxed text-[#68645E] dark:text-[#9E988F]">{message}</p>
    <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
  </div>
);
