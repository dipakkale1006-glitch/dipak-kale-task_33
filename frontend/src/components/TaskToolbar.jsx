import { FILTERS, SORT_OPTIONS } from '../constants';

/**
 * Toolbar - search box, status filter and sort control.
 *
 * The toolbar owns no data; it only reports changes upward so the hook can
 * re-fetch. Keeping it dumb means the filtering rules live in exactly one place
 * (the backend query).
 */
export default function TaskToolbar({
  search,
  status,
  sort,
  disabled = false,
  onSearchChange,
  onStatusChange,
  onSortChange,
}) {
  return (
    <div className="toolbar">
      <label className="toolbar__search">
        <span className="sr-only">Search tasks</span>
        <span className="toolbar__search-icon" aria-hidden="true">
          🔍
        </span>
        <input
          type="search"
          value={search}
          placeholder="Search tasks..."
          disabled={disabled}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="toolbar__filters" role="group" aria-label="Filter by status">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`chip ${status === filter.value ? 'chip--active' : ''}`}
            aria-pressed={status === filter.value}
            disabled={disabled}
            onClick={() => onStatusChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <label className="toolbar__sort">
        <span className="sr-only">Sort tasks</span>
        <select
          value={sort}
          disabled={disabled}
          aria-label="Sort tasks"
          onChange={(event) => onSortChange(event.target.value)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
