import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/customErrors.js';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../speech/worker.py');
const pending = new Map();
let worker, ready, state = 'idle', model = process.env.WHISPER_MODEL || 'base';

export const speechStatus = () => ({ available: state === 'ready', status: state, provider: 'local-whisper', model });
export function startSpeech() {
  if (ready) return ready;
  state = 'starting';
  ready = new Promise((resolve, reject) => {
    let settled = false;
    const fail = (message) => {
      state = 'unavailable';
      const error = new AppError(message, 503);
      if (!settled) { settled = true; reject(error); }
      for (const job of pending.values()) { clearTimeout(job.timer); job.reject(error); }
      pending.clear();
      ready = null;
    };
    worker = spawn(process.env.PYTHON_BIN || 'python', ['-u', script], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    const startTimer = setTimeout(() => {
      fail('Voice transcription is taking too long to start. Type your answer or retry.');
      worker?.kill();
    }, 60000);
    readline.createInterface({ input: worker.stdout }).on('line', (line) => {
      let result;
      try { result = JSON.parse(line); } catch { return; }
      if ('ready' in result) {
        clearTimeout(startTimer);
        if (!result.ready) return fail(result.error);
        settled = true; state = 'ready'; model = result.model; resolve();
        return;
      }
      const job = pending.get(result.id);
      if (job) {
        clearTimeout(job.timer); pending.delete(result.id);
        if (result.error) job.reject(new AppError(result.error, 422));
        else job.resolve(result);
      }
    });
    worker.stderr.on('data', (chunk) => console.warn('[Speech] ' + chunk.toString().trim().slice(0, 300)));
    worker.on('error', () => { clearTimeout(startTimer); fail('Python speech service is unavailable. Type your answer or retry.'); });
    worker.on('exit', () => { clearTimeout(startTimer); fail('Voice transcription stopped. Please retry.'); worker = null; });
  });
  // Startup failure is surfaced by status and transcription endpoints.
  ready.catch(() => {});
  return ready;
}
export async function transcribe(filePath, language = 'en') {
  await startSpeech();
  if (pending.size >= 3) throw new AppError('The speech service is busy. Please retry shortly.', 429);
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new AppError('Transcription timed out. Try a shorter recording.', 504));
      worker?.kill();
    }, 90000);
    pending.set(id, { resolve, reject, timer });
    worker.stdin.write(JSON.stringify({ id, path: filePath, language }) + '\n');
  });
}
export function stopSpeech() { worker?.kill(); }
