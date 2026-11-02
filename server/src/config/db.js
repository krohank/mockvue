import mongoose from 'mongoose';
import { env } from './env.js';
import { seedDemoUsers } from '../utils/seedData.js';

let mongoMemoryServerInstance = null;

const redact = (uri) => uri.replace(/:\/\/[^:@/]+:[^@]+@/, '://***:***@');

const afterConnect = async () => {
  if (env.SEED_DEMO_DATA) {
    await seedDemoUsers();
  }
};

export const connectDB = async () => {
  mongoose.set('strictQuery', true);

  try {
    console.log(`[DB] Connecting to ${redact(env.MONGODB_URI)}`);
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    console.log(`[DB] Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    await afterConnect();
    return { type: 'standard', host: mongoose.connection.host };
  } catch (err) {
    console.warn(`[DB] MongoDB connection failed: ${err.message}`);

    if (!env.ALLOW_IN_MEMORY_DB) {
      console.error('[DB] In-memory fallback disabled. Check MONGODB_URI.');
      throw err;
    }

    console.log('[DB] Starting in-memory MongoDB (data is lost when the server stops)...');
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongoMemoryServerInstance = await MongoMemoryServer.create();
      const memoryUri = mongoMemoryServerInstance.getUri();
      await mongoose.connect(memoryUri);
      console.log(`[DB] In-memory MongoDB ready at ${memoryUri}`);
      await afterConnect();
      return { type: 'in-memory', host: 'in-memory-db' };
    } catch (memErr) {
      console.error(`[DB] Failed to start in-memory MongoDB: ${memErr.message}`);
      throw memErr;
    }
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoMemoryServerInstance) {
      await mongoMemoryServerInstance.stop();
      mongoMemoryServerInstance = null;
      console.log('[DB] In-memory MongoDB stopped.');
    }
    console.log('[DB] Disconnected.');
  } catch (err) {
    console.error(`[DB] Error during disconnection: ${err.message}`);
  }
};

export const isInMemoryDB = () => Boolean(mongoMemoryServerInstance);
