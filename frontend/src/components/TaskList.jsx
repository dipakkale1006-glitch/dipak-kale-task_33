import TaskItem from './TaskItem';

/**
 * TaskList - renders the collection, or the appropriate empty state.
 *
 * Distinguishing "no tasks at all" from "no tasks matching the filters" matters
 * for usability: the second case is confusing without telling the user why the
 * list is empty.
 */
export default function TaskList({ tasks, busyIds, hasFilters, onToggle, onDelete, onEdit }) {
  if (tasks.length === 0) {
    return (
      <div className="empty">
        <p className="empty__icon" aria-hidden="true">
          {hasFilters ? '🔍' : '📝'}
        </p>
        <h3 className="empty__title">
          {hasFilters ? 'No tasks match your filters' : 'No tasks yet'}
        </h3>
        <p className="empty__text">
          {hasFilters
            ? 'Try clearing the search box or switching back to "All".'
            : 'Add your first task above to get started.'}
        </p>
      </div>
    );
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          busy={busyIds.includes(task.id)}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </ul>
  );
}
