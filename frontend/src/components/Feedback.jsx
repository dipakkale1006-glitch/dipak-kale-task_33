/**
 * Shared presentation-only components.
 *
 * Grouped in one file because each is a handful of lines and they are always
 * used together; splitting them into separate modules would add noise without
 * adding clarity.
 */

/** Non-blocking message shown for API failures and successes. */
export function Toast({ message, tone = 'error', onDismiss }) {
  if (!message) return null;

  return (
    <div className={`toast toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="toast__message">{message}</span>
      <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss message">
        ×
      </button>
    </div>
  );
}

/** Full-page style loading indicator used while the first fetch is in flight. */
export function LoadingState({ label = 'Loading tasks...' }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Inline error panel with a retry affordance. */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <p className="error-state__title">Something went wrong</p>
      <p className="error-state__message">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Small connection badge for the header. */
export function ConnectionBadge({ status }) {
  const label = {
    checking: 'Checking...',
    online: 'API connected',
    offline: 'API offline',
  }[status] || status;

  return (
    <span className={`connection connection--${status}`}>
      <span className="connection__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
