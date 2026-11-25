import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startCamera, describeCameraError, attachStream, onCameraLost, cameraPermission, rememberCamera, cameraWasOn, stopCamera } from '../src/services/camera.js';

const domError = (name) => Object.assign(new Error(name), { name });
const navWith = (impl) => ({ mediaDevices: { getUserMedia: impl } });

test('a page that is not https or localhost explains why the camera is hidden', async () => {
  const win = { isSecureContext: false, location: { host: '192.168.1.20:5173' } };
  await assert.rejects(startCamera({ nav: {}, win }), (e) => e.code === 'insecure' && /192\.168\.1\.20:5173/.test(e.message) && /localhost:5173/.test(e.message));
});

test('a browser without camera support says so', async () => {
  await assert.rejects(startCamera({ nav: {}, win: { isSecureContext: true } }), (e) => e.code === 'unsupported');
});

test('permission denied explains how to allow the camera', async () => {
  let calls = 0;
  const nav = navWith(async () => { calls++; throw domError('NotAllowedError'); });
  await assert.rejects(startCamera({ nav, win: {} }), (e) => e.code === 'blocked' && /Allow/.test(e.message));
  assert.equal(calls, 1, 'a denial must not trigger a second prompt');
});

test('a busy camera and a missing camera give different messages', async () => {
  await assert.rejects(startCamera({ nav: navWith(async () => { throw domError('NotReadableError'); }), win: {} }), (e) => e.code === 'in-use' && /Zoom|Teams/.test(e.message));
  await assert.rejects(startCamera({ nav: navWith(async () => { throw domError('NotFoundError'); }), win: {} }), (e) => e.code === 'no-device');
});

test('a webcam that rejects the preferred settings falls back to any camera', async () => {
  const seen = [], stream = { id: 'ok' };
  const nav = navWith(async (constraints) => { seen.push(constraints.video); if (seen.length === 1) throw domError('OverconstrainedError'); return stream; });
  assert.equal(await startCamera({ nav, win: {} }), stream);
  assert.equal(seen[1], true);
});

test('unknown errors keep their name for troubleshooting', () => {
  assert.match(describeCameraError(domError('WeirdError')).message, /WeirdError/);
});

test('attachStream sets the stream, mutes it and calls play', async () => {
  let played = 0;
  const video = { srcObject: null, play: () => { played++; return Promise.reject(domError('AbortError')); } };
  const stream = {};
  await attachStream(video, stream);
  assert.equal(video.srcObject, stream);
  assert.equal(video.muted, true);
  assert.equal(played, 1, 'a rejected play() must not throw');
  await attachStream(null, stream);
});

test('onCameraLost fires when the track ends and can be detached', () => {
  const listeners = [];
  const track = { addEventListener: (_, fn) => listeners.push(fn), removeEventListener: (_, fn) => listeners.splice(listeners.indexOf(fn), 1) };
  let lost = 0;
  const off = onCameraLost({ getVideoTracks: () => [track] }, () => lost++);
  listeners[0]();
  assert.equal(lost, 1);
  off();
  assert.equal(listeners.length, 0);
});

test('stopCamera stops every track', () => {
  let stopped = 0;
  stopCamera({ getTracks: () => [{ stop: () => stopped++ }, { stop: () => stopped++ }] });
  assert.equal(stopped, 2);
  stopCamera(null);
});

test('camera permission falls back to unknown where it cannot be queried', async () => {
  assert.equal(await cameraPermission({ permissions: { query: async () => ({ state: 'granted' }) } }), 'granted');
  assert.equal(await cameraPermission({ permissions: { query: async () => { throw new TypeError('camera unsupported'); } } }), 'unknown');
  assert.equal(await cameraPermission({}), 'unknown');
});

test('the preview choice is remembered for the room and survives missing storage', () => {
  const store = new Map();
  const storage = { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null, removeItem: (k) => store.delete(k) };
  assert.equal(cameraWasOn(storage), false);
  rememberCamera(true, storage);
  assert.equal(cameraWasOn(storage), true);
  rememberCamera(false, storage);
  assert.equal(cameraWasOn(storage), false);
  assert.equal(cameraWasOn(undefined), false);
  rememberCamera(true, undefined);
});
