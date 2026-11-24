import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { transcribe, stopSpeech } from '../src/services/speechService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.local-data');
const fixture = process.env.MOCKVUE_SPEECH_FIXTURE || path.join(root, 'speech-test.wav');
after(() => stopSpeech());
test('real speech is transcribed by the local model', { skip: !(await fs.stat(fixture).catch(() => null)) }, async () => {
  const result = await transcribe(fixture, 'en');
  assert.match(result.text.toLowerCase(), /hash/);
  assert.ok(result.duration > 0);
});
test('silent audio produces a useful error, not a hallucinated transcript', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mockvue-speech-test-'));
  const file = path.join(directory, 'silence.wav');
  try {
    const bytes = Buffer.alloc(32044);
    bytes.write('RIFF', 0); bytes.writeUInt32LE(32036, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36); bytes.writeUInt32LE(32000, 40);
    await fs.writeFile(file, bytes);
    await assert.rejects(transcribe(file, 'en'), /No clear speech/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
