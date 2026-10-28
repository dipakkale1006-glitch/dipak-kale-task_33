'use strict';

/**
 * Task controller - the HTTP layer.
 *
 * Responsibilities are deliberately narrow:
 *   1. read already validated input from the request,
 *   2. call the matching service function,
 *   3. shape the JSON response.
 *
 * No database calls and no business rules live here; anything unexpected is
 * thrown and handled centrally by the error middleware.
 */

const taskService = require('../services/taskService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/apiResponse');

/**
 * POST /api/tasks
 * Creates a task. `req.validated` is populated by the validation middleware,
 * so the controller can trust the shape and lengths of the incoming data.
 */
const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.validated);
  res.status(201).json(success(task, 'Task created successfully'));
});

/**
 * GET /api/tasks
 * Supports filtering, searching, sorting and pagination through query params.
 */
const getTasks = asyncHandler(async (req, res) => {
  const { tasks, total, page, limit, pages } = await taskService.getTasks(req.validated);

  res.status(200).json(
    success(tasks, `${tasks.length} task(s) retrieved`, {
      count: tasks.length,
      total,
      page,
      limit,
      pages,
    }),
  );
});

/**
 * GET /api/tasks/stats
 * Aggregate counts used by the small summary bar in the UI.
 */
const getStats = asyncHandler(async (req, res) => {
  const stats = await taskService.getStats();
  res.status(200).json(success(stats, 'Task statistics retrieved'));
});

/**
 * GET /api/tasks/:id
 */
const getTaskById = asyncHandler(async (req, res) => {
  const task = await taskService.getTaskById(req.params.id);
  res.status(200).json(success(task, 'Task retrieved'));
});

/**
 * PUT /api/tasks/:id
 * Full replacement of the editable fields.
 */
const replaceTask = asyncHandler(async (req, res) => {
  const task = await taskService.replaceTask(req.params.id, req.validated);
  res.status(200).json(success(task, 'Task updated successfully'));
});

/**
 * PATCH /api/tasks/:id
 * Partial update - the common case being the completed toggle.
 */
const updateTask = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.validated);
  res.status(200).json(success(task, 'Task updated successfully'));
});

/**
 * DELETE /api/tasks/:id  (single delete)
 * DELETE /api/tasks?completed=true  (bulk delete)
 *
 * Both verbs land here; the presence of the `completed` query parameter decides
 * which behaviour runs. Keeping them in one handler avoids duplicating the
 * response shape, and the response body reports how many rows were removed.
 */
const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id) {
    const task = await taskService.deleteTask(id);
    return res.status(200).json(success({ id: task.id }, 'Task deleted successfully'));
  }

  const count = await taskService.deleteTasksByCompletion(req.validated.completed);
  const label = req.validated.completed ? 'completed' : 'pending';
  return res.status(200).json(
    success({ count }, `${count} ${label} task(s) deleted successfully`),
  );
});

module.exports = {
  createTask,
  getTasks,
  getStats,
  getTaskById,
  replaceTask,
  updateTask,
  deleteTask,
};
