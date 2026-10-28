'use strict';

/**
 * A tiny, dependency-free validation helper.
 *
 * Why not `express-validator`? The rules here are small enough that a purpose
 * built validator keeps the middleware chain readable and avoids pulling in an
 * extra dependency for a handful of checks. The important part - rejecting bad
 * input with a 400 and returning per-field details - is identical either way.
 *
 * Each `validate...` function returns:
 *   { data, errors }  where `data` holds the cleaned values and `errors` is an
 *   array of { field, message } entries. An empty array means "valid".
 */

const mongoose = require('mongoose');
const { PRIORITIES } = require('../models/Task');

const MAX_TITLE = 160;
const MAX_DESCRIPTION = 1000;
const MAX_CATEGORY = 60;

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

/** Rejects objects/arrays/booleans where a string is expected (NoSQL injection guard). */
function asString(value, field, errors) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    errors.push({ field, message: `${field} must be a string` });
    return undefined;
  }
  return value.trim();
}

function asBoolean(value, field, errors) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  // Accept "true"/"false" because query strings and some form payloads send them.
  if (value === 'true') return true;
  if (value === 'false') return false;
  errors.push({ field, message: `${field} must be a boolean` });
  return undefined;
}

function asDate(value, field, errors) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ field, message: `${field} must be a valid date` });
    return undefined;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Field level checks
// ---------------------------------------------------------------------------

function validateTitle(value, { required }, errors) {
  const title = asString(value, 'title', errors);
  if (title === undefined) {
    if (required && (value === undefined || value === null)) {
      errors.push({ field: 'title', message: 'Title is required' });
    }
    return undefined;
  }
  if (title.length === 0) {
    errors.push({ field: 'title', message: 'Title cannot be empty' });
    return undefined;
  }
  if (title.length < 2) {
    errors.push({ field: 'title', message: 'Title must be at least 2 characters' });
    return undefined;
  }
  if (title.length > MAX_TITLE) {
    errors.push({ field: 'title', message: `Title cannot exceed ${MAX_TITLE} characters` });
    return undefined;
  }
  return title;
}

function validatePriority(value, errors) {
  const priority = asString(value, 'priority', errors);
  if (priority === undefined) return undefined;
  if (!PRIORITIES.includes(priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${PRIORITIES.join(', ')}` });
    return undefined;
  }
  return priority;
}

function validateDescription(value, errors) {
  const description = asString(value, 'description', errors);
  if (description === undefined) return undefined;
  if (description.length > MAX_DESCRIPTION) {
    errors.push({ field: 'description', message: `Description cannot exceed ${MAX_DESCRIPTION} characters` });
    return undefined;
  }
  return description;
}

function validateCategory(value, errors) {
  const category = asString(value, 'category', errors);
  if (category === undefined) return undefined;
  if (category.length > MAX_CATEGORY) {
    errors.push({ field: 'category', message: `Category cannot exceed ${MAX_CATEGORY} characters` });
    return undefined;
  }
  return category;
}

// ---------------------------------------------------------------------------
// Body validators
// ---------------------------------------------------------------------------

const CREATE_ALLOWED = ['title', 'description', 'completed', 'priority', 'category', 'dueDate'];
const UPDATE_ALLOWED = CREATE_ALLOWED;

/** Warns about unknown keys so typos are not silently ignored. */
function collectUnknownKeys(body, allowed) {
  return Object.keys(body).filter((key) => !allowed.includes(key));
}

/** Validation for `POST /api/tasks`. */
function validateCreateTask(body) {
  const errors = [];

  if (!isPlainObject(body)) {
    return { data: null, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const unknown = collectUnknownKeys(body, CREATE_ALLOWED);
  unknown.forEach((key) => errors.push({ field: key, message: `${key} is not a supported field` }));

  const data = {};
  const title = validateTitle(body.title, { required: true }, errors);
  if (title !== undefined) data.title = title;

  const description = validateDescription(body.description, errors);
  if (description !== undefined) data.description = description;

  const completed = asBoolean(body.completed, 'completed', errors);
  if (completed !== undefined) data.completed = completed;

  const priority = validatePriority(body.priority, errors);
  if (priority !== undefined) data.priority = priority;

  const category = validateCategory(body.category, errors);
  if (category !== undefined) data.category = category;

  const dueDate = asDate(body.dueDate, 'dueDate', errors);
  if (dueDate !== undefined) data.dueDate = dueDate;

  return { data: errors.length ? null : data, errors };
}

/**
 * Validation for `PUT /api/tasks/:id` (full update).
 * `title` is required here because PUT replaces the resource.
 */
function validateUpdateTask(body) {
  const errors = [];

  if (!isPlainObject(body)) {
    return { data: null, errors: [{ field: 'body', message: 'Request body must be a JSON object' }] };
  }

  const unknown = collectUnknownKeys(body, UPDATE_ALLOWED);
  unknown.forEach((key) => errors.push({ field: key, message: `${key} is not a supported field` }));

  const data = {};
  const title = validateTitle(body.title, { required: true }, errors);
  if (title !== undefined) data.title = title;

  const description = validateDescription(body.description, errors);
  if (description !== undefined) data.description = description;

  const completed = asBoolean(body.completed, 'completed', errors);
  if (completed !== undefined) data.completed = completed;

  const priority = validatePriority(body.priority, errors);
  if (priority !== undefined) data.priority = priority;

  const category = validateCategory(body.category, errors);
  if (category !== undefined) data.category = category;

  const dueDate = asDate(body.dueDate, 'dueDate', errors);
  if (dueDate !== undefined) data.dueDate = dueDate;

  return { data: errors.length ? null : data, errors };
}

/**
 * Validation for `PATCH /api/tasks/:id` (partial update).
 * Every field is optional, but at least one must be present.
 */
function validatePatchTask(body) {
  const errors = [];
  const bodyEmpty = !isPlainObject(body) || Object.keys(body).length === 0;

  if (bodyEmpty) {
    return { data: null, errors: [{ field: 'body', message: 'Send at least one field to update' }] };
  }

  const unknown = collectUnknownKeys(body, UPDATE_ALLOWED);
  unknown.forEach((key) => errors.push({ field: key, message: `${key} is not a supported field` }));

  const data = {};
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = validateTitle(body.title, { required: false }, errors);
    if (title !== undefined) data.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description = validateDescription(body.description, errors);
    if (description !== undefined) data.description = description;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'completed')) {
    const completed = asBoolean(body.completed, 'completed', errors);
    if (completed !== undefined) data.completed = completed;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) {
    const priority = validatePriority(body.priority, errors);
    if (priority !== undefined) data.priority = priority;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'category')) {
    const category = validateCategory(body.category, errors);
    if (category !== undefined) data.category = category;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) {
    const dueDate = asDate(body.dueDate, 'dueDate', errors);
    if (dueDate !== undefined) data.dueDate = dueDate;
  }

  return { data: errors.length ? null : data, errors };
}

// ---------------------------------------------------------------------------
// Query validator for `GET /api/tasks`
// ---------------------------------------------------------------------------

const SORT_FIELDS = ['createdAt', 'updatedAt', 'dueDate', 'title', 'priority', 'completed'];
const MAX_LIMIT = 100;

/** Validation + normalisation of filter/search/sort/pagination query params. */
function validateTaskQuery(query = {}) {
  const errors = [];
  const data = {};

  if (query.completed !== undefined && query.completed !== '') {
    const completed = asBoolean(query.completed, 'completed', errors);
    if (completed !== undefined) data.completed = completed;
  }

  const priority = validatePriority(query.priority, errors);
  if (priority !== undefined) data.priority = priority;

  const category = validateCategory(query.category, errors);
  if (category !== undefined && category !== '') data.category = category;

  if (query.search !== undefined && query.search !== '') {
    const search = asString(query.search, 'search', errors);
    if (search !== undefined) data.search = search.slice(0, 100);
  }

  if (query.sort !== undefined && query.sort !== '') {
    const raw = asString(query.sort, 'sort', errors);
    if (raw !== undefined) {
      const descending = raw.startsWith('-');
      const field = descending ? raw.slice(1) : raw;
      if (!SORT_FIELDS.includes(field)) {
        errors.push({ field: 'sort', message: `sort must be one of: ${SORT_FIELDS.join(', ')} (prefix with - for descending)` });
      } else {
        data.sort = { [field]: descending ? -1 : 1 };
      }
    }
  }

  if (query.page !== undefined && query.page !== '') {
    const page = Number.parseInt(query.page, 10);
    if (Number.isNaN(page) || page < 1) {
      errors.push({ field: 'page', message: 'page must be a positive integer' });
    } else {
      data.page = page;
    }
  }

  if (query.limit !== undefined && query.limit !== '') {
    const limit = Number.parseInt(query.limit, 10);
    if (Number.isNaN(limit) || limit < 1) {
      errors.push({ field: 'limit', message: 'limit must be a positive integer' });
    } else if (limit > MAX_LIMIT) {
      errors.push({ field: 'limit', message: `limit cannot exceed ${MAX_LIMIT}` });
    } else {
      data.limit = limit;
    }
  }

  return { data: errors.length ? null : data, errors };
}

/** Validation for `DELETE /api/tasks?completed=true`. */
function validateBulkDeleteQuery(query = {}) {
  const errors = [];
  const data = {};

  if (query.completed === undefined || query.completed === '') {
    return {
      data: null,
      errors: [{ field: 'completed', message: 'completed=true|false query parameter is required for a bulk delete' }],
    };
  }

  const completed = asBoolean(query.completed, 'completed', errors);
  if (completed !== undefined) data.completed = completed;

  return { data: errors.length ? null : data, errors };
}

module.exports = {
  validateCreateTask,
  validateUpdateTask,
  validatePatchTask,
  validateTaskQuery,
  validateBulkDeleteQuery,
  isPlainObject,
  constants: { PRIORITIES, SORT_FIELDS, MAX_LIMIT },
};
