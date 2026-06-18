import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'medix-test-secret-key-2024';

/**
 * Connect to the in-memory MongoDB instance.
 */
export async function connectTestDB() {
  const uri = process.env.MONGO_TEST_URI;
  if (!uri) throw new Error('MONGO_TEST_URI not set — did globalSetup run?');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

/**
 * Drop all collections and close connection.
 */
export async function disconnectTestDB() {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    await mongoose.disconnect();
  }
}

/**
 * Clear all collections (between tests).
 */
export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Generate a JWT token for test requests.
 */
export function generateTestToken(userId, storeId) {
  return jwt.sign({ userId: userId.toString(), storeId: storeId.toString() }, JWT_SECRET, {
    expiresIn: '1h',
  });
}

/**
 * Set the JWT_SECRET env var for test runs.
 */
export function setTestEnv() {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.NODE_ENV = 'test';
}
