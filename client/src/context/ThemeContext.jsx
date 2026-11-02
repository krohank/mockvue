import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { local, KEYS } from '../lib/storage';

const ThemeContext = createContext(null);

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(() => local.get(KEYS.theme, 'system'));
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    local.set(KEYS.theme, preference);
  }, [resolved, preference]);

  const toggleTheme = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved]);

  const value = useMemo(
    () => ({ preference, setPreference, theme: resolved, isDark: resolved === 'dark', toggleTheme }),
    [preference, resolved, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
