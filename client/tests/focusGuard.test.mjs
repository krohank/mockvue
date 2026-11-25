import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchFocus } from '../src/services/focusGuard.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function page({ focused = true, visibility = 'visible' } = {}) {
  const handlers = { doc: {}, win: {} };
  const target = (key) => ({ addEventListener: (type, fn) => { handlers[key][type] = fn; }, removeEventListener: (type) => { delete handlers[key][type]; } });
  const doc = { ...target('doc'), visibilityState: visibility, hasFocus: () => focused };
  const win = target('win');
  return { doc, win, handlers, setFocus: (v) => { focused = v; }, setVisibility: (v) => { doc.visibilityState = v; } };
}

test('Alt+Tab to another app (page stays visible, loses focus) is a violation', async () => {
  const p = page(), seen = [];
  watchFocus({ doc: p.doc, win: p.win, delayMs: 20, onViolation: (k) => seen.push(k) });
  p.setFocus(false); p.handlers.win.blur();
  assert.deepEqual(seen, [], 'not immediate, so a split-second flicker is forgiven');
  await wait(60);
  assert.deepEqual(seen, ['blur']);
});

test('focus returning quickly is forgiven', async () => {
  const p = page(), seen = [];
  watchFocus({ doc: p.doc, win: p.win, delayMs: 30, onViolation: (k) => seen.push(k) });
  p.setFocus(false); p.handlers.win.blur();
  await wait(10); p.setFocus(true); p.handlers.win.focus();
  await wait(60);
  assert.deepEqual(seen, []);
});

test('a hidden tab is a violation immediately', () => {
  const p = page(), seen = [];
  watchFocus({ doc: p.doc, win: p.win, onViolation: (k) => seen.push(k) });
  p.setVisibility('hidden'); p.handlers.doc.visibilitychange();
  assert.deepEqual(seen, ['hidden']);
});

test('hiding the tab and losing focus together reports only once', async () => {
  const p = page(), seen = [];
  watchFocus({ doc: p.doc, win: p.win, delayMs: 20, onViolation: (k) => seen.push(k) });
  p.setFocus(false); p.setVisibility('hidden');
  p.handlers.win.blur(); p.handlers.doc.visibilitychange();
  await wait(60);
  assert.deepEqual(seen, ['hidden']);
});

test('a permission prompt or file picker (paused) never counts', async () => {
  const p = page(), seen = []; let paused = true;
  watchFocus({ doc: p.doc, win: p.win, delayMs: 20, isPaused: () => paused, onViolation: (k) => seen.push(k) });
  p.setFocus(false); p.handlers.win.blur();
  p.setVisibility('hidden'); p.handlers.doc.visibilitychange();
  await wait(60);
  assert.deepEqual(seen, []);
  paused = false; p.setVisibility('visible');
  p.handlers.win.blur(); await wait(60);
  assert.deepEqual(seen, ['blur'], 'it counts again once the prompt is gone');
});

test('a prompt that opens during the delay cancels the violation', async () => {
  const p = page(), seen = []; let paused = false;
  watchFocus({ doc: p.doc, win: p.win, delayMs: 30, isPaused: () => paused, onViolation: (k) => seen.push(k) });
  p.setFocus(false); p.handlers.win.blur();
  paused = true;
  await wait(70);
  assert.deepEqual(seen, []);
});

test('stopping the watcher removes every listener and pending check', async () => {
  const p = page(), seen = [];
  const stop = watchFocus({ doc: p.doc, win: p.win, delayMs: 20, onViolation: (k) => seen.push(k) });
  p.setFocus(false); p.handlers.win.blur();
  stop();
  await wait(60);
  assert.deepEqual(seen, []);
  assert.deepEqual([...Object.keys(p.handlers.doc), ...Object.keys(p.handlers.win)], []);
});
