import express from 'express';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { isInMemoryDB } from '../config/db.js';
import { MAX_PROCTORING_WARNINGS } from '../config/constants.js';

const router = express.Router();

const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

router.get('/health', (req, res) => {
  const dbStatus = DB_STATES[mongoose.connection.readyState] || 'unknown';
  res.status(dbStatus === 'connected' ? 200 : 503).json({
    success: dbStatus === 'connected',
    service: 'MockVue API',
    status: dbStatus === 'connected' ? 'operational' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      inMemory: isInMemoryDB(),
    },
    ai: {
      configuredProvider: env.AI_PROVIDER,
      model: env.AI_MODEL,
      hasApiKey: Boolean(env.AI_API_KEY),
    },
    monitoring: {
      mode: env.CV_MONITORING_MODE,
      maxWarnings: MAX_PROCTORING_WARNINGS,
    },
    // Lets the sign-in page offer one-click demo logins only when they exist.
    demoAccounts: env.SEED_DEMO_DATA,
    environment: env.NODE_ENV,
  });
});

export default router;
