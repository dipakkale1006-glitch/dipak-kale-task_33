/**
 * Shared presentation constants and small pure helpers.
 *
 * Keeping them out of components avoids magic strings scattered across files and
 * makes the values easy to change in one place.
 */

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export const SORT_OPTIONS = [
  { value: 'createdAt:-1', label: 'Newest first' },
  { value: 'createdAt:1', label: 'Oldest first' },
  { value: 'dueDate:1', label: 'Due date (soonest)' },
  { value: 'priority:1', label: 'Priority' },
  { value: 'title:1', label: 'Title (A-Z)' },
];

export const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

/**
 * Converts the UI's `field:direction` sort convention into the API's `sort`
 * query parameter, which expects a field name, optionally prefixed with `-`
 * for descending order (e.g. `sort=-createdAt`).
 */
export function toSortParams(sortValue) {
  const [field, direction] = String(sortValue).split(':');
  const descending = direction === '-1' || direction === 'desc';
  return { sort: descending ? `-${field}` : field };
}

/** Formats an ISO date for display, or returns null when there is no date. */
export function formatDate(isoDate) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Human friendly relative label such as "Today", "Tomorrow" or "2 days ago". */
export function formatRelative(isoDate) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target - startOfToday) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/** True when a task is due in the past and still not completed. */
export function isOverdue(task) {
  if (!task?.dueDate || task.completed) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}
