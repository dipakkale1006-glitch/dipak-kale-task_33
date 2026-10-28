'use strict';

/**
 * Parses and validates a task id coming from the URL (or the request body).
 *
 * Mongo throws a `CastError` when a malformed id reaches a query, which would
 * surface as a confusing 500. Validating up front lets us answer with a clean
 * 400 instead, and it guards against NoSQL-injection style payloads such as
 * `{ "$ne": null }` being passed as an id.
 */

const mongoose = require('mongoose');
const ApiError = require('./ApiError');

function assertValidObjectId(value, fieldName = 'id') {
  const candidate = typeof value === 'string' ? value.trim() : value;

  if (typeof candidate !== 'string' || !mongoose.Types.ObjectId.isValid(candidate)) {
    throw ApiError.badRequest(
      `Invalid ${fieldName}: "${String(value)}" is not a valid task id.`,
      { code: 'INVALID_ID' },
    );
  }

  // `isValid` accepts any 12 character string, so make sure the round-trip is exact.
  if (String(new mongoose.Types.ObjectId(candidate)) !== candidate) {
    throw ApiError.badRequest(`Invalid ${fieldName}: "${String(value)}".`, { code: 'INVALID_ID' });
  }

  return candidate;
}

module.exports = { assertValidObjectId };
