'use strict';

/**
 * Converts a Mongoose document into the plain JSON shape the API exposes.
 *
 * Three jobs:
 *  1. Rename Mongo's `_id` to `id` so the frontend never has to know about `_id`.
 *  2. Drop internal fields (`__v`), so the payload stays clean and stable.
 *  3. Expose the `isOverdue` virtual, so the UI can highlight late tasks without
 *     repeating the date maths on the client.
 */
function serializeTask(document) {
  if (!document) return null;

  const task = typeof document.toObject === 'function' ? document.toObject({ virtuals: true }) : document;

  return {
    id: String(task._id),
    title: task.title,
    description: task.description || '',
    completed: Boolean(task.completed),
    priority: task.priority,
    category: task.category || '',
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
    updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : null,
    isOverdue: Boolean(task.isOverdue),
  };
}

/** Maps an array of documents, skipping any null/undefined entries. */
function serializeTasks(documents = []) {
  return documents.map(serializeTask).filter(Boolean);
}

module.exports = { serializeTask, serializeTasks };
