import { describe, test, expect } from 'vitest';
import { formatDate, formatRelative, isOverdue, toSortParams } from '../src/constants';

/** Unit tests for the small pure helpers used by the UI. */

describe('toSortParams', () => {
  test('passes an ascending field through unchanged', () => {
    expect(toSortParams('title:1')).toEqual({ sort: 'title' });
  });

  test('prefixes a descending field with a minus sign', () => {
    expect(toSortParams('createdAt:-1')).toEqual({ sort: '-createdAt' });
  });
});

describe('formatDate', () => {
  test('formats an ISO date for display', () => {
    expect(formatDate('2026-10-25T00:00:00.000Z')).toMatch(/2026/);
  });

  test('returns null for missing or invalid input', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate('not-a-date')).toBeNull();
  });
});

describe('formatRelative', () => {
  test('labels today and tomorrow', () => {
    const today = new Date();
    const tomorrow = new Date(Date.now() + 86400000);

    expect(formatRelative(today.toISOString())).toBe('Today');
    expect(formatRelative(tomorrow.toISOString())).toBe('Tomorrow');
  });

  test('returns null without a date', () => {
    expect(formatRelative(null)).toBeNull();
  });
});

describe('isOverdue', () => {
  test('is true for a past due, unfinished task', () => {
    expect(isOverdue({ dueDate: '2020-01-01T00:00:00.000Z', completed: false })).toBe(true);
  });

  test('is false when the task is completed', () => {
    expect(isOverdue({ dueDate: '2020-01-01T00:00:00.000Z', completed: true })).toBe(false);
  });

  test('is false for a future due date', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isOverdue({ dueDate: future, completed: false })).toBe(false);
  });

  test('is false when there is no due date', () => {
    expect(isOverdue({ dueDate: null, completed: false })).toBe(false);
  });
});
