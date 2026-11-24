import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BSON } from 'mongodb';
import { env } from './env.js';
import { seedDemoUsers } from '../utils/seedData.js';

const dataRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.local-data');
let localServer;

export const connectDB = async () => {
  mongoose.set('strictQuery', false);
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
  } catch (error) {
    if (!env.isDev) throw error;
    await mongoose.disconnect();
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = path.join(dataRoot, 'mongodb');
    await fs.mkdir(dbPath, { recursive: true });
    localServer = await MongoMemoryServer.create({
      instance: { dbPath, dbName: 'mockvue', storageEngine: 'wiredTiger', ip: '127.0.0.1' },
    });
    await mongoose.connect(localServer.getUri('mockvue'));
    // Import the old temporary database once, preserving accounts and interview history.
    if (await mongoose.connection.db.collection('users').countDocuments() === 0) {
      try {
        const snapshot = BSON.EJSON.parse(await fs.readFile(path.join(dataRoot, 'pre-audit-backup.json'), 'utf8'));
        for (const [collection, docs] of Object.entries(snapshot)) {
          if (docs.length) await mongoose.connection.db.collection(collection).insertMany(docs);
        }
        console.log('[DB] Restored previous local data.');
      } catch (restoreError) {
        if (restoreError.code !== 'ENOENT') throw restoreError;
      }
    }
    console.log('[DB] Persistent local database: ' + dbPath);
  }
  if (env.isDev) await seedDemoUsers();
  console.log('[DB] Connected: ' + mongoose.connection.name);
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (localServer) await localServer.stop({ doCleanup: false, force: false });
};
