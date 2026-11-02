import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';
const isDev = NODE_ENV === 'development';

const DEV_ONLY_JWT_SECRET = 'mockvue-local-development-secret-do-not-use-in-production';

const resolveJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (isProd) {
    throw new Error(
      '[ENV] JWT_SECRET is missing or shorter than 16 characters. Set a long random value before starting in production.'
    );
  }
  if (!isTest) {
    console.warn('[ENV] JWT_SECRET not set — using an insecure development-only secret.');
  }
  return DEV_ONLY_JWT_SECRET;
};

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const AI_PROVIDER = (process.env.AI_PROVIDER || 'fallback').toLowerCase();

const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  fallback: 'curated-bank',
};

export const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mockvue',
  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  AI_PROVIDER,
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || DEFAULT_MODELS[AI_PROVIDER] || DEFAULT_MODELS.fallback,
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS) || 20000,
  CV_MONITORING_MODE: process.env.CV_MONITORING_MODE || 'client',
  // In-memory MongoDB fallback is a development convenience only.
  ALLOW_IN_MEMORY_DB: bool(process.env.ALLOW_IN_MEMORY_DB, !isProd),
  SEED_DEMO_DATA: bool(process.env.SEED_DEMO_DATA, !isProd),
  // Serve the built client (client/dist) from Express. Defaults on in production.
  SERVE_CLIENT: bool(process.env.SERVE_CLIENT, isProd),
  TRUST_PROXY: bool(process.env.TRUST_PROXY, false),
  isDev,
  isTest,
  isProd,
};
