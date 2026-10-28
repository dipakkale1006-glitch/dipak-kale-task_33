import { useCallback, useEffect, useState } from 'react';
import * as taskApi from '../api/taskApi';

/**
 * useApiHealth - polls the backend health endpoint so the UI can tell the user
 * when the API is unreachable, instead of only failing once they try an action.
 */
export default function useApiHealth(intervalMs = 30000) {
  const [status, setStatus] = useState('checking');

  const check = useCallback(async () => {
    try {
      await taskApi.checkHealth();
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, intervalMs);
    return () => clearInterval(timer);
  }, [check, intervalMs]);

  return { status, check };
}
