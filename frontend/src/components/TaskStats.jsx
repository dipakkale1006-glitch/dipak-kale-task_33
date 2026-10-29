/**
 * Small visual summary of how the workload is going.
 * The numbers come from `GET /api/tasks/stats`, so they stay correct no matter
 * which filter is currently applied to the list.
 */
export default function TaskStats({ stats, total }) {
  const safeStats = stats || { total: 0, completed: 0, pending: 0 };
  const completion = safeStats.total > 0 ? Math.round(((safeStats.completed || 0) / safeStats.total) * 100) : 0;

  return (
    <section className="stats" aria-label="Task summary">
      <div className="stats__item">
        <span className="stats__value">{safeStats.total || 0}</span>
        <span className="stats__label">Total</span>
      </div>
      <div className="stats__item">
        <span className="stats__value stats__value--pending">{safeStats.pending || 0}</span>
        <span className="stats__label">Pending</span>
      </div>
      <div className="stats__item">
        <span className="stats__value stats__value--completed">{safeStats.completed || 0}</span>
        <span className="stats__label">Completed</span>
      </div>

      <div className="stats__progress" role="group" aria-label="Completion progress">
        <div className="stats__progress-track">
          <div className="stats__progress-bar" style={{ width: `${completion}%` }} />
        </div>
        <span className="stats__progress-label">
          {completion}% complete{total !== undefined ? ` · showing ${total}` : ''}
        </span>
      </div>
    </section>
  );
}
