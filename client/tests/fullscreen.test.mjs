import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enterInterviewFullscreen } from '../src/services/fullscreen.js';

test('fullscreen is requested immediately within the user gesture', async () => {
  const page = { fullscreenElement: null, documentElement: {} };
  let complete, requested = false;
  page.documentElement.requestFullscreen = () => {
    requested = true;
    return new Promise((resolve) => { complete = () => { page.fullscreenElement = page.documentElement; resolve(); }; });
  };
  const entering = enterInterviewFullscreen(page);
  assert.equal(requested, true);
  complete();
  await entering;
});

test('an existing fullscreen session does not request another transition', async () => {
  const page = { fullscreenElement: {}, documentElement: { requestFullscreen: () => { throw new Error('Unexpected transition'); } } };
  await enterInterviewFullscreen(page);
});

test('unavailable or policy-disabled fullscreen has a readable error', async () => {
  await assert.rejects(enterInterviewFullscreen({ documentElement: {} }), /unavailable in this browser/);
  await assert.rejects(enterInterviewFullscreen({ fullscreenEnabled: false, documentElement: { requestFullscreen() { throw new Error('Must not run'); } } }), /unavailable in this browser/);
});

test('a rejected browser request gives a recovery action', async () => {
  await assert.rejects(enterInterviewFullscreen({ documentElement: { requestFullscreen: async () => { throw new TypeError('Permission denied'); } } }), /Enter full screen to try again/);
});

test('a resolved request without actual fullscreen is not reported as success', async () => {
  await assert.rejects(enterInterviewFullscreen({ fullscreenElement: null, documentElement: { requestFullscreen: async () => {} } }), /Full screen did not open/);
});
