import { formatDate, formatRelative, isOverdue } from '../constants';

/**
 * TaskItem - a single row in the list.
 *
 * It is purely presentational: it receives a task plus the callbacks it should
 * fire. All fetching lives in the `useTasks` hook, so this component stays easy
 * to read and to test.
 */
export default function TaskItem({ task, busy = false, onToggle, onDelete, onEdit }) {
  const overdue = isOverdue(task);
  const due = task.dueDate ? formatDate(task.dueDate) : null;
  const relative = task.dueDate ? formatRelative(task.dueDate) : null;

  return (
    <li
      className={[
        'task',
        task.completed ? 'task--completed' : '',
        overdue ? 'task--overdue' : '',
        busy ? 'task--busy' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <label className="task__checkbox">
        <input
          type="checkbox"
          checked={task.completed}
          disabled={busy}
          aria-label={`Mark "${task.title}" as ${task.completed ? 'pending' : 'completed'}`}
          onChange={() => onToggle(task)}
        />
        <span className="task__tick" aria-hidden="true" />
      </label>

      <div className="task__body">
        <div className="task__headline">
          <h3 className="task__title">{task.title}</h3>

          <span className={`badge badge--${task.priority}`}>{task.priority}</span>

          {task.category && task.category !== 'general' && (
            <span className="badge badge--category">{task.category}</span>
          )}

          {overdue && <span className="badge badge--overdue">Overdue</span>}
        </div>

        {task.description && <p className="task__description">{task.description}</p>}

        {due && (
          <p className="task__meta">
            <span aria-hidden="true">📅</span> Due {due}
            {relative ? ` (${relative})` : ''}
          </p>
        )}
      </div>

      <div className="task__actions">
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => onEdit(task)}
          disabled={busy}
          aria-label={`Edit "${task.title}"`}
          title="Edit task"
        >
          ✏️
        </button>
        <button
          type="button"
          className="btn btn--icon btn--danger"
          onClick={() => onDelete(task)}
          disabled={busy}
          aria-label={`Delete "${task.title}"`}
          title="Delete task"
        >
          🗑️
        </button>
      </div>
    </li>
  );
}
