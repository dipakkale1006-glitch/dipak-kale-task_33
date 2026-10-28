'use strict';

const express = require('express');

const taskRoutes = require('./taskRoutes');
const { isDatabaseReady } = require('../config/database');
const { success } = require('../utils/apiResponse');

const router = express.Router();

/**
 * API router - mounted at `/api` in app.js.
 *
 * Health / readiness probe.
 *
 * Kept separate from the task routes because hosting platforms (Render, etc.)
 * ping it to decide whether the service is alive, and it must stay cheap and
 * dependency free.
 */
router.get('/health', (req, res) => {
  const uptimeSeconds = Math.round(process.uptime());

  res.status(200).json(
    success(
      {
        status: 'ok',
        uptime: uptimeSeconds,
        database: isDatabaseReady() ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      },
      'To-Do List API is running',
    ),
  );
});

// Task resource routes -> /api/tasks
router.use('/tasks', taskRoutes);

module.exports = router;
