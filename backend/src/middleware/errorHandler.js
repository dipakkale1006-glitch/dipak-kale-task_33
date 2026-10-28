'use strict';

const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { failure } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Central error handler - the single place that turns a thrown value into an
 * HTTP response.
 *
 * Express only recognises error middleware when it declares four parameters, so
 * `next` must stay in the signature even though it is unused.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  const normalised = normalise(error);

  // Unexpected (non-operational) failures are logged with a stack trace, since
  // they are bugs we want to see. Expected failures are logged as warnings.
  if (normalised.isOperational) {
    logger.warn(`${req.method} ${req.originalUrl} -> ${normalised.statusCode} ${normalised.message}`);
  } else {
    logger.error(`${req.method} ${req.originalUrl} -> ${normalised.statusCode} ${error.stack || error.message}`);
  }

  const body = failure(normalised.message, normalised.code, normalised.details);

  // Never leak implementation details to the client in production.
  if (!env.isProduction && !normalised.isOperational) {
    body.debug = { name: error.name, message: error.message };
  }

  res.status(normalised.statusCode).json(body);
}

/** Maps anything thrown in the app onto a well formed `ApiError`. */
function normalise(error) {
  if (error instanceof ApiError) return error;

  // Mongoose schema validation -> 400 with per-field details.
  if (error.name === 'ValidationError' && error.errors) {
    return ApiError.validationError(
      Object.values(error.errors).map((detail) => ({
        field: detail.path,
        message: detail.message,
      })),
    );
  }

  // A malformed ObjectId reached the database.
  if (error.name === 'CastError') {
    return ApiError.badRequest(`Invalid value for ${error.path}: "${error.value}"`, { code: 'INVALID_ID' });
  }

  // Duplicate key (e.g. a unique index added later).
  if (error.code === 11000) {
    return ApiError.conflict('A task with those details already exists');
  }

  // Malformed JSON body - body-parser sets `type` to 'entity.parse.failed'.
  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return ApiError.badRequest('Request body contains invalid JSON', { code: 'INVALID_JSON' });
  }

  if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
    return new ApiError(503, 'Database unavailable, please try again shortly', { code: 'DB_UNAVAILABLE' });
  }

  return ApiError.internal();
}

module.exports = errorHandler;
