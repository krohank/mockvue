import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { protect } from '../middleware/auth.middleware.js';
import { speechStatus, startSpeech, transcribe } from '../services/speechService.js';
import { ValidationError } from '../utils/customErrors.js';

const router = express.Router();
router.use(protect);
router.get('/status', (req, res) => {
  if (speechStatus().status === 'idle') startSpeech().catch(() => {});
  res.json({ success: true, ...speechStatus() });
});
router.post('/transcribe',
  rateLimit({ windowMs: 60000, max: 12, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many recordings. Please wait a minute.' } }),
  express.raw({ type: ['audio/*', 'video/webm', 'video/mp4', 'application/octet-stream'], limit: '15mb' }),
  async (req, res, next) => {
    let directory;
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length < 1000) throw new ValidationError('Record or upload an audio clip first.');
      const language = req.query.language || 'en';
      if (!['en', 'hi', 'auto'].includes(language)) throw new ValidationError('Unsupported transcription language.');
      directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mockvue-audio-'));
      const audioPath = path.join(directory, 'answer.audio');
      await fs.writeFile(audioPath, req.body);
      const result = await transcribe(audioPath, language);
      res.json({ success: true, text: result.text, language: result.language, duration: result.duration, provider: 'local-whisper' });
    } catch (error) { next(error); }
    finally { if (directory) await fs.rm(directory, { recursive: true, force: true }); }
  }
);
export default router;
