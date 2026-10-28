'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Catches any request that did not match a route.
 * Registered after every router in app.js.
 */
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFoundHandler;
