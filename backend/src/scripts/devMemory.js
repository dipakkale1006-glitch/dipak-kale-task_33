'use strict';

/**
 * Development / smoke-test bootstrap that runs the real API against a throwaway
 * in-memory MongoDB instance.
 *
 * Why: it lets anyone clone the repo and try the API (and the React frontend)
 * without installing MongoDB or creating an Atlas cluster.
 *
 *   npm run dev:memory
 *
 * The database is empty on every start - use `npm run dev` with a real
 * MONGODB_URI when you need data to persist.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../app');
const env = require('../config/env');
const logger = require('../utils/logger');

async function main() {
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'todoapp' } });
  const uri = mongod.getUri();

  await mongoose.connect(uri, { dbName: 'todoapp' });
  logger.info(`In-memory MongoDB started -> ${uri}`);
  logger.warn('In-memory mode: all data is discarded when this process exits.');

  const server = app.listen(env.port, '0.0.0.0', () => {
    logger.info(`To-Do List API listening on http://localhost:${env.port} (in-memory MongoDB)`);
  });

  const shutdown = async (signal) => {
    logger.warn(`${signal} received - shutting down`);
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  logger.error(`Failed to start in-memory server: ${error.message}`);
  process.exit(1);
});
