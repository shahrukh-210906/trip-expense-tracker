import mongoose from 'mongoose';
import 'dotenv/config';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error('Set MONGODB_URI in your local .env file.');
  }
  // Disable buffering so missing connections fail rather than silently queue writes.
  mongoose.set('bufferCommands', false);
  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB_NAME || 'trip_expense_tracker',
    serverSelectionTimeoutMS: 8000,
    autoIndex: false,
  });
  return mongoose.connection;
}
export const disconnectDatabase = () => mongoose.disconnect();
