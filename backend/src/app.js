'use strict';

/**
 * Express application factory.
 *
 * The app is created but **not** started here, so tests can import it directly
 * with supertest without binding a port. `server.js` is the only file that calls
 * `listen()`.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const rateLimiter = require('./middleware/rateLimiter');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const { failure } = require('./utils/apiResponse');

const app = express();

// ---------------------------------------------------------------------------
// Security & platform middleware
// ---------------------------------------------------------------------------

// Sensible security headers. `crossOriginResourcePolicy` is relaxed so the
// Netlify hosted frontend can read the responses.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

/**
 * CORS:
 *  - `CORS_ORIGIN` unset  -> allow every origin (development convenience).
 *  - `CORS_ORIGIN` set    -> allow only the listed origins.
 * Requests without an Origin header (curl, Postman, server-to-server, health
 * checks) are always allowed.
 */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.corsOrigin.length === 0) return callback(null, true);
      if (env.corsOrigin.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// Request logging. Disabled during tests to keep the output readable.
if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

// Body parsers. A modest limit stops oversized payloads from being accepted.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Basic abuse protection for every route.
app.use(rateLimiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Friendly landing response so opening the deployed root URL is not a 404.
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'To-Do List API',
    data: {
      version: '1.0.0',
      documentation: 'See README.md for the full endpoint list',
      endpoints: {
        health: 'GET /api/health',
        listTasks: 'GET /api/tasks',
        createTask: 'POST /api/tasks',
        taskStats: 'GET /api/tasks/stats',
        getTask: 'GET /api/tasks/:id',
        replaceTask: 'PUT /api/tasks/:id',
        updateTask: 'PATCH /api/tasks/:id',
        deleteTask: 'DELETE /api/tasks/:id',
        bulkDelete: 'DELETE /api/tasks?completed=true',
      },
    },
  });
});

app.use('/api', routes);

// ---------------------------------------------------------------------------
// Fallbacks - order is important: 404 first, then the error handler.
// ---------------------------------------------------------------------------
app.use(notFoundHandler);

// Converts thrown errors / rejected promises into JSON responses.
app.use(errorHandler);

// Final safety net for errors thrown outside the Express pipeline (e.g. a bad
// CORS rejection reaching the default handler).
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  return res.status(500).json(failure('Unexpected server error', 'INTERNAL_ERROR'));
});

module.exports = app;
