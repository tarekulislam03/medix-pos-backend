import { MongoMemoryReplSet } from 'mongodb-memory-server';

let mongod;

export default async function globalSetup() {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  process.env.MONGO_TEST_URI = uri;
  // Store instance reference for teardown
  globalThis.__MONGOD__ = mongod;
}
