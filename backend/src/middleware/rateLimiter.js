'use strict';

const rateLimit = require('express-rate-limit');

const env = require('../config/env');
const { failure } = require('../utils/apiResponse');

/**
 * Simple IP based rate limiter to protect the API from abuse and accidental
 * request loops in the frontend.
 *
 * Limits are configurable through the environment so a busy deployment can raise
 * them without a code change.
 */
const rateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  // Tests fire many requests quickly and should not be throttled.
  skip: () => env.isTest,
  handler: (req, res) => {
    res
      .status(429)
      .json(failure('Too many requests from this IP, please try again later.', 'RATE_LIMITED'));
  },
});

module.exports = rateLimiter;
