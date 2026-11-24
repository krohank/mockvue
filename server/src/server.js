import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { startSpeech, stopSpeech } from './services/speechService.js';
import { startEvaluationWorker, stopEvaluationWorker } from './services/evaluationQueue.js';

let server;

const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDB();
    startEvaluationWorker();
    startSpeech().catch((error) => console.warn('[Speech]', error.message));

    // 2. Start HTTP Listener
    server = app.listen(env.PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 MockVue API Server running in [${env.NODE_ENV}] mode`);
      console.log(`📡 Port: http://localhost:${env.PORT}`);
      console.log(`🩺 Healthcheck: http://localhost:${env.PORT}/api/health`);
      console.log(`🌐 Allowed Client URL: ${env.CLIENT_URL}`);
      console.log(`🤖 AI Provider: ${env.AI_PROVIDER}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
};

// Graceful Shutdown
const handleShutdown = async (signal) => {
  stopSpeech();
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing HTTP server and database...`);
  if (server) {
    server.close(async () => {
      console.log('[SHUTDOWN] HTTP server closed.');
      await stopEvaluationWorker();
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION] at:', promise, 'reason:', reason);
});

startServer();
