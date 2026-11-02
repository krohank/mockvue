#!/usr/bin/env node
/**
 * Self-hosts the computer-vision runtime so proctoring works without
 * third-party CDNs at exam time:
 *   - copies MediaPipe WASM from node_modules → public/mediapipe/wasm
 *   - downloads the face landmarker + object detector models → public/models
 *
 * Runs on `npm install` (postinstall) and before builds. Network failures are
 * non-fatal: the app falls back to the CDN at runtime.
 * Set MOCKVUE_SKIP_MODEL_DOWNLOAD=1 to skip downloads.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const wasmSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDest = path.join(publicDir, 'mediapipe', 'wasm');
const modelDest = path.join(publicDir, 'models');

const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

const MODELS = [
  {
    file: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    file: 'efficientdet_lite0.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite',
  },
];

const log = (msg) => console.log(`[vision-assets] ${msg}`);

const copyWasm = () => {
  if (!fs.existsSync(wasmSrc)) {
    log('MediaPipe package not installed yet — skipping WASM copy.');
    return;
  }
  fs.mkdirSync(wasmDest, { recursive: true });
  let copied = 0;
  for (const file of WASM_FILES) {
    const from = path.join(wasmSrc, file);
    const to = path.join(wasmDest, file);
    if (!fs.existsSync(from)) continue;
    const same = fs.existsSync(to) && fs.statSync(to).size === fs.statSync(from).size;
    if (!same) {
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }
  log(copied ? `Copied ${copied} WASM file(s).` : 'WASM files up to date.');
};

const download = async ({ file, url }) => {
  const target = path.join(modelDest, file);
  if (fs.existsSync(target) && fs.statSync(target).size > 100_000) return 'cached';
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(`${target}.tmp`, buffer);
  fs.renameSync(`${target}.tmp`, target);
  return `${(buffer.length / 1e6).toFixed(1)} MB`;
};

const main = async () => {
  copyWasm();
  if (process.env.MOCKVUE_SKIP_MODEL_DOWNLOAD === '1') {
    log('Model download skipped (MOCKVUE_SKIP_MODEL_DOWNLOAD=1).');
    return;
  }
  fs.mkdirSync(modelDest, { recursive: true });
  for (const model of MODELS) {
    try {
      log(`${model.file}: ${await download(model)}`);
    } catch (err) {
      log(`${model.file}: download failed (${err.message}). The app will load it from the CDN instead.`);
    }
  }
};

main().catch((err) => {
  log(`Setup failed (${err.message}). The app will use CDN assets.`);
});
