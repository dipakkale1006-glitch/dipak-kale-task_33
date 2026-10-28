'use strict';

/**
 * Server bootstrap.
 *
 * 1. Connect to MongoDB first - the API is useless without it, and failing at
 *    boot is far easier to diagnose than failing on the first request.
 * 2. Start listening.
 * 3. Handle signals and unhandled rejections so the process shuts down cleanly
 *    (important on Render / containers, where a hung process is forcibly killed).
 */

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDatabase, disconnectDatabase, maskUri } = require('./config/database');

let server;

async function start() {
  try {
    await connectDatabase();
    logger.info(`Database connected -> ${maskUri(env.mongodbUri)}`);

    // 0.0.0.0 is required so the app is reachable from outside a container.
    server = app.listen(env.port, '0.0.0.0', () => {
      logger.info(`To-Do List API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

/** Closes the HTTP server and the database connection, then exits. */
async function shutdown(signal) {
  logger.warn(`${signal} received - shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await disconnectDatabase();
    logger.info('Shutdown complete');
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.message : reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  shutdown('uncaughtException');
});

start();

module.exports = { start, shutdown };
