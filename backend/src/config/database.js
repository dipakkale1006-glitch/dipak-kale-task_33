'use strict';

const mongoose = require('mongoose');

const env = require('./env');
const logger = require('../utils/logger');

/**
 * Opens the MongoDB connection.
 *
 * Mongoose buffers queries by default, which hides connection problems and makes
 * requests hang. We disable buffering so a query issued while disconnected fails
 * fast with a clear error instead of timing out.
 */
async function connectDatabase(uri = env.mongodbUri) {
  mongoose.set('strictQuery', true);
  // Fail fast instead of silently buffering commands.
  mongoose.set('bufferCommands', false);

  mongoose.connection.on('connected', () => {
    logger.info(`MongoDB connected -> ${maskUri(uri)}`);
  });
  mongoose.connection.on('error', (error) => {
    logger.error(`MongoDB connection error: ${error.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(uri, {
    // Keep the connection pool modest; a small API does not need the default 100.
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

/** Hides the password inside a connection string before logging it. */
function maskUri(uri) {
  return String(uri).replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

/** True when the driver is currently connected. */
function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  isDatabaseReady,
  maskUri,
};
