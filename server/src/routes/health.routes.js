import express from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { speechStatus } from '../services/speechService.js';
import { aiService } from '../services/ai/AIProviderFactory.js';

const router = express.Router();

router.get('/health', async (req, res, next) => {
  try {
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  }[mongoose.connection.readyState] || 'unknown';

  res.status(200).json({
    success: true,
    service: 'MockVue API Engine',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      name: mongoose.connection.name || 'none',
      host: mongoose.connection.host || 'none',
    },
    ai: await aiService.status(),
    monitoring: {
      mode: env.CV_MONITORING_MODE,
    },
    speech: speechStatus(),
    environment: env.NODE_ENV,
  });
  } catch (error) { next(error); }
});

export default router;
