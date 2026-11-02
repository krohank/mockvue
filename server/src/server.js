import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

let server;

const startServer = async () => {
  try {
    await connectDB();

    server = app.listen(env.PORT, () => {
      console.log('──────────────────────────────────────────────');
      console.log(`MockVue API (${env.NODE_ENV}) listening on http://localhost:${env.PORT}`);
      console.log(`Health:      http://localhost:${env.PORT}/api/health`);
      console.log(`Client URL:  ${env.CLIENT_URL}`);
      console.log(`AI provider: ${env.AI_PROVIDER} (${env.AI_MODEL})`);
      console.log('──────────────────────────────────────────────');
    });
  } catch (error) {
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
};

const handleShutdown = async (signal) => {
  console.log(`\n[SHUTDOWN] ${signal} received. Closing server...`);
  const finish = async () => {
    await disconnectDB();
    process.exit(0);
  };
  if (server) {
    server.close(finish);
    // Force exit if connections hang.
    setTimeout(() => process.exit(0), 5000).unref();
  } else {
    await finish();
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

startServer();
