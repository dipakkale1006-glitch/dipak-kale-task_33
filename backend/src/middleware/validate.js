'use strict';

/**
 * Request validation middleware factory.
 *
 * The validator functions return `{ data, errors }`. This wrapper turns them
 * into an Express middleware that either:
 *   - stores the cleaned values on `req.validated` and calls `next()`, or
 *   - throws a 400 `ApiError` carrying the per-field details.
 *
 * A `source` option decides whether to validate the body (`post`/`put`/`patch`),
 * the query string (`get`/`delete`), or the params.
 */

const ApiError = require('../utils/ApiError');

function validate(validatorFn, source = 'body') {
  return (req, res, next) => {
    const input = source === 'query' ? req.query : source === 'params' ? req.params : req.body;
    const { data, errors } = validatorFn(input || {});

    if (errors && errors.length > 0) {
      return next(ApiError.validationError(errors));
    }

    // Controllers read from `req.validated` only, never from the raw input.
    req.validated = data;
    return next();
  };
}

module.exports = validate;
