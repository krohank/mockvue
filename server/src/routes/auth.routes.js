import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { env } from '../config/env.js';

const router = express.Router();

// Slow down credential stuffing / brute force. Successful logins don't count.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

router.post('/register', credentialLimiter, register);
router.post('/login', credentialLimiter, login);
router.get('/me', protect, getMe);

export default router;
