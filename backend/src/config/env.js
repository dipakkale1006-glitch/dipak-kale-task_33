'use strict';

/**
 * Loads environment variables from `.env` once, and exposes them as a frozen,
 * typed config object. Every other module imports from here instead of reading
 * `process.env` directly - that keeps defaults and parsing in one place.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load `.env` from the backend root regardless of the current working directory.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

// `CORS_ORIGIN` is a comma separated list. An empty value means "allow all",
// which is handy in development but should never be used in production.
const corsOrigin = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 5000),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todoapp',
  corsOrigin,
  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
  },
};

// Derived flags - must be assigned before the object is frozen.
env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

Object.freeze(env);
Object.freeze(env.rateLimit);

module.exports = env;
