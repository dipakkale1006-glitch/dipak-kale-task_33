'use strict';

/**
 * Task service - the layer that owns business logic and talks to MongoDB.
 *
 * Controllers stay thin (parse HTTP -> call service -> send response) and the
 * service never touches `req`/`res`. That split makes the logic unit-testable
 * without spinning up an HTTP server, and keeps the database details in one
 * place. All methods throw `ApiError` for expected failures.
 */

const Task = require('../models/Task');
const ApiError = require('../utils/ApiError');
const { serializeTask, serializeTasks } = require('../utils/serializeTask');
const { assertValidObjectId } = require('../utils/validateObjectId');

const DEFAULT_LIMIT = 50;

/**
 * Creates a new task.
 *
 * The unique identifier is **not** supplied by the client - MongoDB generates
 * the document's ObjectId, which is exactly the strategy planned in Task 32.
 *
 * @param {object} payload Already validated task fields
 */
async function createTask(payload) {
  const task = await Task.create({
    title: payload.title,
    description: payload.description ?? '',
    completed: payload.completed ?? false,
    priority: payload.priority ?? 'medium',
    category: payload.category || 'general',
    dueDate: payload.dueDate ?? null,
  });

  return serializeTask(task);
}

/**
 * Returns a filtered, sorted, paginated list of tasks.
 *
 * @param {object} options Validated query options
 * @returns {Promise<{ tasks: object[], total: number, page: number, limit: number, pages: number }>}
 */
async function getTasks(options = {}) {
  const filter = {};

  if (typeof options.completed === 'boolean') filter.completed = options.completed;
  if (options.priority) filter.priority = options.priority;
  if (options.category) filter.category = options.category;

  if (options.search) {
    // Escape regex metacharacters so a search such as "c++" or "(urgent)" is
    // treated as literal text and cannot be used to build a catastrophic regex.
    const safe = options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(safe, 'i');
    filter.$or = [{ title: pattern }, { description: pattern }, { category: pattern }];
  }

  const sort = options.sort && Object.keys(options.sort).length
    ? options.sort
    // Pending tasks first, newest first - the ordering the UI expects by default.
    : { completed: 1, createdAt: -1 };

  const page = Math.max(options.page || 1, 1);
  const limit = Math.min(Math.max(options.limit || DEFAULT_LIMIT, 1), 100);
  const skip = (page - 1) * limit;

  // Run both queries in parallel; they are independent.
  const [documents, total] = await Promise.all([
    Task.find(filter).sort(sort).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);

  return {
    tasks: serializeTasks(documents),
    total,
    page,
    limit,
    pages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

/**
 * Fetches a single task by id.
 * @throws {ApiError} 404 when no task matches
 */
async function getTaskById(id) {
  const objectId = assertValidObjectId(id);
  const task = await Task.findById(objectId);
  if (!task) {
    throw ApiError.notFound(`Task not found: no task exists with id ${id}`);
  }
  return serializeTask(task);
}

/**
 * Full update (PUT). Fields that are not supplied fall back to their defaults,
 * matching the "replace the resource" semantics of PUT.
 */
async function replaceTask(id, payload) {
  const objectId = assertValidObjectId(id);
  const task = await Task.findById(objectId);
  if (!task) {
    throw ApiError.notFound(`Task not found: no task exists with id ${id}`);
  }

  task.title = payload.title;
  task.description = payload.description ?? '';
  task.completed = payload.completed ?? false;
  task.priority = payload.priority ?? 'medium';
  task.category = payload.category || 'general';
  task.dueDate = payload.dueDate ?? null;

  await task.save();
  return serializeTask(task);
}

/**
 * Partial update (PATCH). Only the keys present in `payload` are touched, which
 * is what makes the checkbox toggle efficient.
 */
async function updateTask(id, payload) {
  const objectId = assertValidObjectId(id);
  const task = await Task.findById(objectId);
  if (!task) {
    throw ApiError.notFound(`Task not found: no task exists with id ${id}`);
  }

  // Whitelist the mutable fields - never copy the raw body onto the document.
  const allowed = ['title', 'description', 'completed', 'priority', 'category', 'dueDate'];
  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      task[field] = payload[field];
    }
  });

  await task.save();
  return serializeTask(task);
}

/** Convenience wrapper used by the UI checkbox. */
async function toggleTaskCompletion(id) {
  const objectId = assertValidObjectId(id);
  const task = await Task.findById(objectId);
  if (!task) {
    throw ApiError.notFound(`Task not found: no task exists with id ${id}`);
  }

  task.completed = !task.completed;
  await task.save();
  return serializeTask(task);
}

/** Deletes one task and returns the deleted representation. */
async function deleteTask(id) {
  const objectId = assertValidObjectId(id);
  const task = await Task.findByIdAndDelete(objectId);
  if (!task) {
    throw ApiError.notFound(`Task not found: no task exists with id ${id}`);
  }
  return serializeTask(task);
}

/**
 * Deletes every task matching `completed`.
 * @returns {Promise<number>} Number of deleted documents
 */
async function deleteTasksByCompletion(completed) {
  const result = await Task.deleteMany({ completed });
  return result.deletedCount || 0;
}

/** Aggregate counts for the dashboard / stats endpoint. */
async function getStats() {
  const [result] = await Task.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: ['$completed', 1, 0] } },
      },
    },
  ]);

  const total = result?.total || 0;
  const completed = result?.completed || 0;

  return { total, completed, pending: total - completed };
}

/** Removes every task - used by the test suite and the seed script. */
async function deleteAllTasks() {
  const result = await Task.deleteMany({});
  return result.deletedCount || 0;
}

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  replaceTask,
  updateTask,
  toggleTaskCompletion,
  deleteTask,
  deleteTasksByCompletion,
  getStats,
  deleteAllTasks,
  DEFAULT_LIMIT,
};
