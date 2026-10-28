'use strict';

/**
 * Helpers that build the JSON envelope returned by every endpoint.
 *
 * Keeping one shape means the React client can always rely on:
 *   { success, message, data }        on success
 *   { success, message, code, errors } on failure
 */

/**
 * @param {*} data            Payload for the client
 * @param {string} [message]  Human readable summary
 * @param {object} [meta]     Extra information (count, pagination, ...)
 */
function success(data = null, message = 'OK', meta = undefined) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return body;
}

/**
 * @param {string} message
 * @param {string} [code]
 * @param {*} [errors] Validation details
 */
function failure(message = 'Something went wrong', code = 'INTERNAL_ERROR', errors = undefined) {
  const body = { success: false, message, code };
  if (errors) body.errors = errors;
  return body;
}

module.exports = { success, failure };
