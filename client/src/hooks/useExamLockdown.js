import { useEffect, useRef } from 'react';

export const isFullscreen = () =>
  Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

export const fullscreenSupported = () =>
  Boolean(
    document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.documentElement.requestFullscreen ||
      document.documentElement.webkitRequestFullscreen
  );

export const enterFullscreen = async () => {
  const el = document.documentElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (!request) return false;
  try {
    await request.call(el, { navigationUI: 'hide' });
  } catch {
    return false;
  }
  // Where supported (Chromium), require a long-press of Esc to leave full screen.
  try {
    await navigator.keyboard?.lock?.(['Escape']);
  } catch {
    /* optional */
  }
  return isFullscreen();
};

export const exitFullscreen = async () => {
  try {
    navigator.keyboard?.unlock?.();
  } catch {
    /* ignore */
  }
  if (!isFullscreen()) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  try {
    await exit?.call(document);
  } catch {
    /* ignore */
  }
};

const SHORTCUTS = [
  { test: (e) => e.key === 'F12', label: 'Developer tools (F12)' },
  { test: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()), label: 'Developer tools' },
  { test: (e) => e.metaKey && e.altKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()), label: 'Developer tools' },
  { test: (e) => (e.ctrlKey || e.metaKey) && ['c', 'x'].includes(e.key.toLowerCase()) && !e.shiftKey, label: 'Copy' },
  { test: (e) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v', label: 'Paste', type: 'paste_attempt' },
  { test: (e) => (e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(e.key.toLowerCase()), label: 'Print / save / view source' },
  { test: (e) => (e.ctrlKey || e.metaKey) && ['r', 't', 'n', 'w'].includes(e.key.toLowerCase()), label: 'Browser navigation' },
  { test: (e) => e.key === 'F5', label: 'Reload' },
  { test: (e) => e.altKey && ['ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key), label: 'Navigation' },
];

/**
 * Exam browser rules while `active`:
 *   - tab hidden / app switched for longer than `blurGraceMs` / full screen exited → onCritical
 *   - brief focus loss, blocked shortcuts, paste, context menu → onWarning
 * Handlers are read from refs so callers don't need to memoize them.
 */
export const useExamLockdown = ({ active, onCritical, onWarning, blurGraceMs = 1500, requireFullscreen = true }) => {
  const criticalRef = useRef(onCritical);
  const warningRef = useRef(onWarning);
  const lastWarnRef = useRef({});

  useEffect(() => {
    criticalRef.current = onCritical;
    warningRef.current = onWarning;
  }, [onCritical, onWarning]);

  useEffect(() => {
    if (!active) return undefined;
    let blurTimer = null;

    // Collapse bursts (e.g. key repeat) of the same kind into one warning.
    const warn = (type, message) => {
      const now = Date.now();
      if (now - (lastWarnRef.current[type] || 0) < 3000) return;
      lastWarnRef.current[type] = now;
      warningRef.current?.(type, message);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        criticalRef.current?.('tab_switched', 'You left the interview tab.');
      }
    };

    const onBlur = () => {
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (!document.hasFocus()) criticalRef.current?.('window_focus_lost', 'You switched to another window or application.');
      }, blurGraceMs);
    };

    const onFocus = () => {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
        warn('window_blurred', 'The interview window briefly lost focus.');
      }
    };

    const onFullscreenChange = () => {
      if (requireFullscreen && !isFullscreen()) {
        criticalRef.current?.('fullscreen_exit', 'You exited full-screen mode.');
      }
    };

    const onKeyDown = (e) => {
      const hit = SHORTCUTS.find((s) => s.test(e));
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      warn(hit.type || 'keyboard_shortcut_violation', `${hit.label} is blocked during the interview.`);
    };

    const onClipboard = (e) => {
      e.preventDefault();
      if (e.type === 'paste') warn('paste_attempt', 'Pasting text is blocked during the interview.');
      else warn('keyboard_shortcut_violation', 'Copying text is blocked during the interview.');
    };

    const onContextMenu = (e) => {
      e.preventDefault();
      warn('keyboard_shortcut_violation', 'The right-click menu is disabled during the interview.');
    };

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('copy', onClipboard, true);
    document.addEventListener('cut', onClipboard, true);
    document.addEventListener('paste', onClipboard, true);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('copy', onClipboard, true);
      document.removeEventListener('cut', onClipboard, true);
      document.removeEventListener('paste', onClipboard, true);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [active, blurGraceMs, requireFullscreen]);
};
