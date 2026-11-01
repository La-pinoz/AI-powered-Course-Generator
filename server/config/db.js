import mongoose from 'mongoose';
import config from './env.js';

export default async function connectDB() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log(`[db] MongoDB connected (database: ${mongoose.connection.name})`);
  } catch (err) {
    console.error(`[db] MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
}
