import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import interviewRoutes from './routes/interview.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
const serveClient = env.SERVE_CLIENT && fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

const app = express();

if (env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

// The SPA needs WebAssembly (MediaPipe), Google Fonts, and the MediaPipe model CDN.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: serveClient
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'wasm-unsafe-eval'", 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            mediaSrc: ["'self'", 'blob:', 'mediastream:'],
            connectSrc: ["'self'", 'https://storage.googleapis.com', 'https://cdn.jsdelivr.net'],
            workerSrc: ["'self'", 'blob:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            // Don't force https sub-requests: breaks LAN/localhost demos served over http.
            upgradeInsecureRequests: null,
          },
        }
      : false,
  })
);

const allowedOrigins = new Set([env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']);
app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin requests and non-browser clients send no Origin header.
      if (!origin || allowedOrigins.has(origin) || env.isDev) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

if (!env.isTest) {
  app.use(morgan(env.isDev ? 'dev' : 'combined'));
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Proctoring telemetry and evaluation calls are frequent during a session.
  limit: env.isTest ? 10_000 : 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
});
app.use('/api', apiLimiter);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/analytics', analyticsRoutes);

if (serveClient) {
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      maxAge: '7d',
      setHeaders: (res, filePath) => {
        // Hashed assets can be cached aggressively; HTML must revalidate.
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    })
  );
  // SPA fallback for client-side routes.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'MockVue API is running.', healthcheck: '/api/health', version: '2.0.0' });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
