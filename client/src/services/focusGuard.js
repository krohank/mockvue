// Detects when the student leaves the interview page during an assessment.
//
// Two different things can happen when someone "switches screens":
//  - the tab or window is hidden (another tab, minimised window)  -> visibilitychange
//  - the window stays visible but loses focus (Alt+Tab to another app, clicking a
//    second monitor, a notification or chat window)                -> blur, with visibilityState still "visible"
// Watching only visibilitychange misses the second case entirely.

export function watchFocus({ doc = globalThis.document, win = globalThis.window, onViolation, isPaused = () => false, delayMs = 800 }) {
  let timer = null, fired = false;
  const fire = (kind) => { if (fired) return; fired = true; onViolation(kind); };
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

  const visibility = () => {
    if (doc.visibilityState === 'hidden' && !isPaused()) { clear(); fire('hidden'); }
  };
  // Focus can leave for a split second (a browser prompt, a window animation).
  // It only counts if the page is still unfocused after a short delay.
  const blur = () => {
    if (timer || fired || isPaused()) return;
    timer = setTimeout(() => {
      timer = null;
      if (!isPaused() && doc.visibilityState !== 'hidden' && !doc.hasFocus()) fire('blur');
    }, delayMs);
  };

  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('blur', blur);
  win.addEventListener('focus', clear);
  return () => {
    clear();
    doc.removeEventListener('visibilitychange', visibility);
    win.removeEventListener('blur', blur);
    win.removeEventListener('focus', clear);
  };
}
