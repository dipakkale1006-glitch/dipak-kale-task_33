import { useCallback, useEffect, useRef, useState } from 'react';
import * as taskApi from '../api/taskApi';
import { toSortParams } from '../constants';

/**
 * useTasks - the single source of truth for task data on the client.
 *
 * Owning fetching + mutations in one hook means:
 *   - components stay presentational,
 *   - there is exactly one place that knows how to refresh the list,
 *   - loading and error state are handled consistently everywhere.
 *
 * Actions update the list optimistically where it improves the feel (toggle,
 * delete) and roll back if the request fails.
 */
export default function useTasks({ search = '', status = 'all', sort = 'createdAt:-1' } = {}) {
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyIds, setBusyIds] = useState([]);

  // Prevents a stale response from overwriting a newer one when the user types
  // quickly. Each request records an id; only the latest is allowed to apply.
  const requestIdRef = useRef(0);

  const loadTasks = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);

    try {
      const params = { ...toSortParams(sort) };

      if (status === 'pending') params.completed = false;
      if (status === 'completed') params.completed = true;
      if (search.trim()) params.search = search.trim();

      const { tasks: fetched, meta: fetchedMeta } = await taskApi.fetchTasks(params);

      if (requestIdRef.current !== requestId) return; // superseded - ignore
      setTasks(fetched);
      setMeta(fetchedMeta || { total: fetched.length, count: fetched.length });
    } catch (requestError) {
      if (requestIdRef.current !== requestId) return;
      setError(requestError.message);
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [search, status, sort]);

  // Debounce so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(loadTasks, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadTasks, search]);

  const markBusy = (id, busy) => {
    setBusyIds((current) => (busy ? [...current, id] : current.filter((value) => value !== id)));
  };

  /** POST /api/tasks */
  const addTask = useCallback(async (payload) => {
    const created = await taskApi.createTask(payload);
    // New tasks sort first in the default view; reloading keeps the ordering and
    // the counters correct rather than guessing where to splice it in.
    await loadTasks();
    return created;
  }, [loadTasks]);

  /** PUT /api/tasks/:id */
  const editTask = useCallback(async (id, payload) => {
    markBusy(id, true);
    try {
      const updated = await taskApi.replaceTask(id, payload);
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      return updated;
    } finally {
      markBusy(id, false);
    }
  }, []);

  /** PATCH /api/tasks/:id - optimistic toggle. */
  const toggleTask = useCallback(async (id) => {
    const previous = tasks;
    const target = tasks.find((task) => task.id === id);
    if (!target) return;

    // Flip locally first so the checkbox responds instantly.
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)),
    );
    markBusy(id, true);

    try {
      const updated = await taskApi.setTaskCompleted(id, !target.completed);
      setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      return updated;
    } catch (toggleError) {
      setTasks(previous); // roll back
      throw toggleError;
    } finally {
      markBusy(id, false);
    }
  }, [tasks]);

  /** DELETE /api/tasks/:id - optimistic removal. */
  const removeTask = useCallback(async (id) => {
    const previous = tasks;
    setTasks((current) => current.filter((task) => task.id !== id));
    markBusy(id, true);

    try {
      await taskApi.deleteTask(id);
      await loadTasks();
    } catch (deleteError) {
      setTasks(previous); // roll back
      throw deleteError;
    } finally {
      markBusy(id, false);
    }
  }, [tasks, loadTasks]);

  /** DELETE /api/tasks?completed=true */
  const clearCompleted = useCallback(async () => {
    const result = await taskApi.deleteCompletedTasks();
    await loadTasks();
    return result;
  }, [loadTasks]);

  return {
    tasks,
    meta,
    loading,
    error,
    busyIds,
    reload: loadTasks,
    addTask,
    editTask,
    toggleTask,
    removeTask,
    clearCompleted,
    clearError: () => setError(null),
  };
}
