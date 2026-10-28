'use strict';

/**
 * Very small logger wrapper.
 *
 * Wrapping `console` in one module means:
 *  - we can silence logs during tests,
 *  - the format (timestamp + level) is consistent everywhere,
 *  - swapping in a real logger (pino/winston) later is a one-file change.
 */

const env = require('../config/env');

const levels = ['error', 'warn', 'info', 'debug'];

function format(level, message) {
  return `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
}

function write(level, message) {
  if (env.isTest) return; // keep test output clean
  const line = format(level, message);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const logger = levels.reduce((acc, level) => {
  acc[level] = (message) => write(level, message);
  return acc;
}, {});

module.exports = logger;
