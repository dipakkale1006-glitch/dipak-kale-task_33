import axios from 'axios';

/**
 * Configured Axios instance.
 *
 * Centralising it means the base URL, timeout and error normalisation only
 * exist once, and every component gets consistent behaviour for free.
 */

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Turns any Axios failure into a predictable Error with a friendly message and
 * the per-field details returned by the backend.
 *
 * Components therefore never need to inspect `error.response.status` themselves.
 */
function normaliseError(error) {
  // Request was cancelled (e.g. the user typed again while searching).
  if (axios.isCancel(error)) {
    const cancelled = new Error('Request cancelled');
    cancelled.cancelled = true;
    return cancelled;
  }

  const response = error.response;

  if (response) {
    const payload = response.data || {};
    const normalised = new Error(
      payload.message || `Request failed with status ${response.status}`,
    );
    normalised.status = response.status;
    normalised.code = payload.code;
    normalised.details = payload.errors || [];
    return normalised;
  }

  if (error.code === 'ECONNABORTED') {
    return new Error('The server took too long to respond. Please try again.');
  }

  return new Error(
    'Cannot reach the server. Make sure the backend is running and the API URL is correct.',
  );
}

// Unwrap the `{ success, message, data }` envelope so callers get the payload
// directly, and route every failure through `normaliseError`.
api.interceptors.response.use(
  (response) => {
    if (typeof response.data === 'string' && (response.data.includes('<!doctype html') || response.data.includes('<html'))) {
      return Promise.reject(new Error('Cannot reach the API. The server returned HTML instead of JSON.'));
    }
    return response;
  },
  (error) => Promise.reject(normaliseError(error)),
);

export default api;
export { baseURL };
