import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export default async function globalSetup() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_TEST_URI = uri;
  // Store instance reference for teardown
  globalThis.__MONGOD__ = mongod;
}
