import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount anything rendered by the previous test.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
