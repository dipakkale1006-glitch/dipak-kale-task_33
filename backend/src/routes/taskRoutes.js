'use strict';

const express = require('express');

const taskController = require('../controllers/taskController');
const validate = require('../middleware/validate');
const {
  validateCreateTask,
  validateUpdateTask,
  validatePatchTask,
  validateTaskQuery,
  validateBulkDeleteQuery,
} = require('../validators/taskValidator');

const router = express.Router();

/**
 * Task routes.
 *
 * Mounted at `/api/tasks` in app.js. Only routing + middleware wiring happens
 * here - all logic sits in the controller and service layers.
 *
 * Route ORDER matters: static segments such as `/stats` must be declared before
 * the dynamic `/:id` route, otherwise Express would treat "stats" as an id.
 */

// --- Collection routes ------------------------------------------------------

// GET /api/tasks?completed=&priority=&category=&search=&sort=&page=&limit=
router.get('/', validate(validateTaskQuery, 'query'), taskController.getTasks);

// GET /api/tasks/stats - declared before /:id on purpose (see note above).
router.get('/stats', taskController.getStats);

// POST /api/tasks
router.post('/', validate(validateCreateTask, 'body'), taskController.createTask);

// DELETE /api/tasks?completed=true - bulk delete of completed/pending tasks.
router.delete('/', validate(validateBulkDeleteQuery, 'query'), taskController.deleteTask);

// --- Single resource routes -------------------------------------------------

// GET /api/tasks/:id
router.get('/:id', taskController.getTaskById);

// PUT /api/tasks/:id - full update
router.put('/:id', validate(validateUpdateTask, 'body'), taskController.replaceTask);

// PATCH /api/tasks/:id - partial update (e.g. toggle completed)
router.patch('/:id', validate(validatePatchTask, 'body'), taskController.updateTask);

// DELETE /api/tasks/:id
router.delete('/:id', taskController.deleteTask);

module.exports = router;
