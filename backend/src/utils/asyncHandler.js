'use strict';

/**
 * Wraps an async route handler so a rejected promise is forwarded to Express's
 * error pipeline automatically.
 *
 * Without this every controller needs its own try/catch, which is repetitive and
 * easy to forget. With it, controllers can simply `throw ApiError...`.
 *
 * @param {Function} fn Async (req, res, next) handler
 * @returns {Function} Handler with errors routed to `next`
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
