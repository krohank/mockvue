import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioRecorder, microphoneError } from '../src/services/audioRecorder.js';

const setup = (getUserMedia) => {
  globalThis.window = { MediaRecorder: FakeRecorder };
  globalThis.MediaRecorder = FakeRecorder;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } });
};
class FakeRecorder {
  static isTypeSupported() { return true; }
  constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
  start() { this.state = 'recording'; this.ondataavailable({ data: new Blob(['one transcript']) }); }
  stop() { this.state = 'inactive'; queueMicrotask(() => this.onstop()); }
}
test('recording returns one clip and releases all microphone tracks', async () => {
  let stops = 0; const track = { stop: () => stops++, onended: null };
  setup(async () => ({ getAudioTracks: () => [track], getTracks: () => [track] }));
  const recorder = new AudioRecorder(); await recorder.start();
  const audio = await recorder.stop();
  assert.equal(await audio.text(), 'one transcript'); assert.equal(stops, 1);
  assert.equal((await recorder.stop()).size, audio.size);
});
test('permission denial has a useful recovery message', async () => {
  setup(async () => { const error = new Error('denied'); error.name = 'NotAllowedError'; throw error; });
  await assert.rejects(new AudioRecorder().start(), { name: 'NotAllowedError' });
  assert.match(microphoneError({ name: 'NotAllowedError' }), /Allow it/);
});
test('unmounting during a permission prompt releases the eventual stream', async () => {
  let resolve, stops = 0;
  setup(() => new Promise((done) => { resolve = done; }));
  const recorder = new AudioRecorder(), starting = recorder.start();
  recorder.dispose();
  const track = { stop: () => stops++ };
  resolve({ getAudioTracks: () => [track], getTracks: () => [track] });
  await starting; assert.equal(stops, 1); assert.equal(recorder.recorder, null);
});
test('unsupported browsers offer upload and typing instead of failing silently', async () => {
  globalThis.window = {};
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  await assert.rejects(new AudioRecorder().start(), /Upload an audio file or type/);
});

test('a disconnected microphone preserves the captured clip for retry', async () => {
  let complete, stops = 0, warning;
  const captured = new Promise((resolve) => { complete = resolve; });
  const track = { stop: () => stops++, onended: null };
  setup(async () => ({ getAudioTracks: () => [track], getTracks: () => [track] }));
  const recorder = new AudioRecorder({ onError: (message) => { warning = message; }, onInterrupted: complete });
  await recorder.start(); track.onended();
  const clip = await captured;
  assert.equal(await clip.text(), 'one transcript'); assert.equal(stops, 1);
  assert.match(warning, /disconnected/);
});
