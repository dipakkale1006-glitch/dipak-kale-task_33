'use strict';

/**
 * Operational error with an HTTP status code.
 *
 * Anything thrown as an `ApiError` is expected (validation problems, missing
 * resources, ...) and its message is safe to send to the client. All other
 * thrown values are treated as unexpected bugs and are masked with a generic
 * 500 message by the error middleware.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message    Client safe message
   * @param {object} [options]
   * @param {string} [options.code]    Machine readable code, e.g. VALIDATION_ERROR
   * @param {Array}  [options.details] Extra per-field details (validation errors)
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || 'API_ERROR';
    this.details = options.details || undefined;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', options) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', ...options });
  }

  static validationError(details, message = 'Validation failed') {
    return new ApiError(400, message, { code: 'VALIDATION_ERROR', details });
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message = 'Resource already exists') {
    return new ApiError(409, message, { code: 'CONFLICT' });
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message, { code: 'RATE_LIMITED' });
  }

  static internal(message = 'Something went wrong') {
    return new ApiError(500, message, { code: 'INTERNAL_ERROR' });
  }
}

module.exports = ApiError;
