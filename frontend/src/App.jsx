import { useMemo, useState } from 'react';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';
import TaskStats from './components/TaskStats';
import TaskToolbar from './components/TaskToolbar';
import { ConnectionBadge, ErrorState, LoadingState, Toast } from './components/Feedback';
import useTasks from './hooks/useTasks';
import useStats from './hooks/useStats';
import useApiHealth from './hooks/useApiHealth';

/**
 * App - composition root.
 *
 * Responsibilities kept here on purpose:
 *   - owning the UI state (search text, filter, sort, which task is being edited),
 *   - wiring the hooks to the presentational components,
 *   - showing feedback for async operations.
 *
 * All HTTP details live in `src/api`, and all task data logic lives in `useTasks`.
 */
export default function App() {
  // --- UI state -------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('createdAt:-1');
  const [editingTask, setEditingTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // --- Data -----------------------------------------------------------------
  const {
    tasks,
    meta,
    loading,
    error,
    busyIds,
    reload,
    addTask,
    editTask,
    toggleTask,
    removeTask,
    clearCompleted,
  } = useTasks({ search, status, sort });

  const { stats, reload: reloadStats } = useStats();
  const { status: apiStatus, check: recheckApi } = useApiHealth();

  const hasFilters = useMemo(() => Boolean(search.trim()) || status !== 'all', [search, status]);

  const notify = (message, tone = 'error') => setToast({ message, tone });
  const dismissToast = () => setToast(null);

  /**
   * Runs an async action, surfacing a friendly message on failure.
   * Keeps every handler free of repetitive try/catch + toast boilerplate.
   */
  async function runAction(action, { successMessage, failureMessage }) {
    try {
      const result = await action();
      if (successMessage) notify(successMessage, 'success');
      return result;
    } catch (actionError) {
      // A cancelled request (superseded search) is not a real failure.
      if (actionError.cancelled) return undefined;
      const details = actionError.details?.length
        ? ` ${actionError.details.map((item) => item.message).join(' ')}`
        : '';
      notify(`${failureMessage || actionError.message}${details}`);
      return undefined;
    }
  }

  // --- Handlers -------------------------------------------------------------

  async function handleCreate(payload) {
    setSubmitting(true);
    await runAction(() => addTask(payload), {
      successMessage: `"${payload.title}" added`,
      failureMessage: 'Could not add the task.',
    });
    setSubmitting(false);
    reloadStats();
  }

  async function handleUpdate(payload) {
    if (!editingTask) return;

    setSubmitting(true);
    const updated = await runAction(() => editTask(editingTask.id, payload), {
      successMessage: 'Task updated',
      failureMessage: 'Could not update the task.',
    });
    setSubmitting(false);

    if (updated) {
      setEditingTask(null);
      reloadStats();
    }
  }

  async function handleToggle(task) {
    await runAction(() => toggleTask(task.id), {
      failureMessage: 'Could not update the task status.',
    });
    reloadStats();
  }

  async function handleDelete(task) {
    const confirmed = window.confirm(`Delete "${task.title}"? This cannot be undone.`);
    if (!confirmed) return;

    await runAction(() => removeTask(task.id), {
      successMessage: 'Task deleted',
      failureMessage: 'Could not delete the task.',
    });
    reloadStats();
  }

  async function handleClearCompleted() {
    const confirmed = window.confirm('Delete all completed tasks? This cannot be undone.');
    if (!confirmed) return;

    const result = await runAction(() => clearCompleted(), {
      failureMessage: 'Could not clear completed tasks.',
    });

    if (result) {
      notify(`${result.count} completed task(s) removed`, 'success');
      reloadStats();
    }
  }

  function handleRetry() {
    recheckApi();
    reload();
    reloadStats();
  }

  // --- Render ---------------------------------------------------------------

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-inner">
          <div>
            <h1 className="app__title">To-Do List</h1>
            <p className="app__subtitle">
              MERN stack demo · React + Axios on the front, Express + MongoDB on the back
            </p>
          </div>
          <ConnectionBadge status={apiStatus} />
        </div>
      </header>

      <main className="app__main">
        <TaskStats stats={stats} total={meta.total} />

        {apiStatus === 'offline' && (
          <ErrorState
            message="The API is not reachable. Start the backend (npm run dev in the backend folder) or check VITE_API_URL."
            onRetry={handleRetry}
          />
        )}

        <Toast
          message={toast?.message}
          tone={toast?.tone}
          onDismiss={dismissToast}
        />

        <section className="panel">
          <h2 className="panel__title">{editingTask ? 'Edit task' : 'Add a new task'}</h2>
          <TaskForm
            key={editingTask?.id ?? 'new'}
            initialValues={editingTask}
            submitting={submitting}
            onSubmit={editingTask ? handleUpdate : handleCreate}
            onCancel={editingTask ? () => setEditingTask(null) : undefined}
          />
        </section>

        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">
              Your tasks
              {meta.total > 0 && <span className="panel__count">{meta.count} of {meta.total}</span>}
            </h2>

            {stats.completed > 0 && (
              <button type="button" className="btn btn--ghost btn--small" onClick={handleClearCompleted}>
                Clear completed
              </button>
            )}
          </div>

          <TaskToolbar
            search={search}
            status={status}
            sort={sort}
            disabled={loading}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onSortChange={setSort}
          />

          {loading && tasks.length === 0 ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={handleRetry} />
          ) : (
            <TaskList
              tasks={tasks}
              busyIds={busyIds}
              hasFilters={hasFilters}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={setEditingTask}
            />
          )}

          {loading && tasks.length > 0 && <LoadingState label="Refreshing..." />}
        </section>
      </main>

      <footer className="app__footer">
        <p>
          Task 33 · To-Do List app with Express.js, MongoDB and React
        </p>
      </footer>
    </div>
  );
}
