import { useCallback, useEffect, useState } from 'react';
import * as taskApi from '../api/taskApi';

/**
 * useStats - keeps the summary numbers in sync with the backend.
 *
 * The counts come from `GET /api/tasks/stats` rather than being derived from the
 * currently displayed list, because the list can be filtered. `refreshKey`
 * lets the parent trigger a reload after any mutation.
 */
export default function useStats(refreshKey = 0) {
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await taskApi.fetchStats();
      if (data && typeof data === 'object') {
        setStats({
          total: data.total || 0,
          completed: data.completed || 0,
          pending: data.pending || 0,
        });
      }
      setError(null);
    } catch (statsError) {
      // Stats are a nice-to-have; a failure here should not break the page.
      setError(statsError.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { stats, error, reload: load };
}
