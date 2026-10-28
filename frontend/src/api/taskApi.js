import api from './client';

/**
 * Task API - one thin function per backend endpoint.
 *
 * Components import these instead of calling axios directly, so the URLs and
 * payload shapes live in a single file. Every function returns the unwrapped
 * `data` from the API envelope and throws a normalised Error on failure.
 */

/** GET /api/tasks - supports filtering, searching, sorting and pagination. */
export async function fetchTasks(params = {}) {
  const response = await api.get('/tasks', { params });
  return { tasks: response.data.data, meta: response.data.meta };
}

/** GET /api/tasks/:id */
export async function fetchTaskById(id) {
  const response = await api.get(`/tasks/${id}`);
  return response.data.data;
}

/** POST /api/tasks */
export async function createTask(payload) {
  const response = await api.post('/tasks', payload);
  return response.data.data;
}

/** PUT /api/tasks/:id - full replacement. */
export async function replaceTask(id, payload) {
  const response = await api.put(`/tasks/${id}`, payload);
  return response.data.data;
}

/** PATCH /api/tasks/:id - partial update (edit, or toggle completed). */
export async function updateTask(id, payload) {
  const response = await api.patch(`/tasks/${id}`, payload);
  return response.data.data;
}

/** Convenience wrapper for the checkbox. */
export function setTaskCompleted(id, completed) {
  return updateTask(id, { completed });
}

/** DELETE /api/tasks/:id */
export async function deleteTask(id) {
  const response = await api.delete(`/tasks/${id}`);
  return response.data.data;
}

/** DELETE /api/tasks?completed=true */
export async function deleteCompletedTasks() {
  const response = await api.delete('/tasks', { params: { completed: true } });
  return response.data.data;
}

/** GET /api/tasks/stats */
export async function fetchStats() {
  const response = await api.get('/tasks/stats');
  return response.data.data;
}

/** GET /api/health - used to show whether the backend is reachable. */
export async function checkHealth() {
  const response = await api.get('/health');
  return response.data.data;
}
