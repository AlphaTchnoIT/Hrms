import mongoose from 'mongoose';
import { env } from './env.js';

// Host part of the connection string only (never log the user name / password)
const safeTarget = () => env.mongoUri.replace(/^mongodb(\+srv)?:\/\/([^@]*@)?/, '').split('/')[0];

/*
 * Connects to MongoDB, retrying with a clear log line on each failure
 * (e.g. Atlas network access list not allowing the host, wrong MONGO_URI).
 */
export async function connectDB({ retries = 10 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    console.log(`Connecting to MongoDB at ${safeTarget()} (attempt ${attempt}/${retries})...`);
    try {
      await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
      console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      return;
    } catch (error) {
      console.error(`MongoDB connection failed: ${error.message}`);
      if (attempt === retries) {
        console.error('Giving up. Check MONGO_URI and that the database allows connections from this server (Atlas -> Network Access).');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}
