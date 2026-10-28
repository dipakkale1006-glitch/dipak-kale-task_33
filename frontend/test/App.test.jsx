import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../src/App';
import * as taskApi from '../src/api/taskApi';

/**
 * Component tests for the integrated app.
 *
 * The API module is mocked, so these tests verify the *integration contract*:
 * the right endpoint functions are called with the right payloads, and the UI
 * reflects whatever the backend returns. No server or database is needed.
 */

vi.mock('../src/api/taskApi');

const sampleTasks = [
  {
    id: '507f1f77bcf86cd799439011',
    title: 'Write the API tests',
    description: 'Cover the CRUD endpoints',
    completed: false,
    priority: 'high',
    category: 'study',
    dueDate: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    isOverdue: false,
  },
  {
    id: '507f1f77bcf86cd799439012',
    title: 'Deploy to Render',
    description: '',
    completed: true,
    priority: 'medium',
    category: 'work',
    dueDate: null,
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    isOverdue: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();

  taskApi.fetchTasks.mockResolvedValue({
    tasks: sampleTasks,
    meta: { total: 2, count: 2, page: 1, limit: 50, pages: 1 },
  });
  taskApi.fetchStats.mockResolvedValue({ total: 2, completed: 1, pending: 1 });
  taskApi.checkHealth.mockResolvedValue({ status: 'ok' });
  taskApi.createTask.mockResolvedValue({ ...sampleTasks[0], id: 'new-id', title: 'New task' });
  taskApi.setTaskCompleted.mockImplementation((id, completed) =>
    Promise.resolve({ ...sampleTasks[0], id, completed }),
  );
  taskApi.deleteTask.mockResolvedValue({ id: sampleTasks[0].id });
  taskApi.replaceTask.mockImplementation((id, payload) =>
    Promise.resolve({ ...sampleTasks[0], id, ...payload }),
  );
  taskApi.deleteCompletedTasks.mockResolvedValue({ count: 1 });
});

describe('App - rendering', () => {
  test('loads and displays tasks from the API', async () => {
    render(<App />);

    expect(await screen.findByText('Write the API tests')).toBeInTheDocument();
    expect(screen.getByText('Deploy to Render')).toBeInTheDocument();
    expect(taskApi.fetchTasks).toHaveBeenCalled();
  });

  test('shows the summary numbers returned by the stats endpoint', async () => {
    render(<App />);
    await screen.findByText('Write the API tests');

    expect(taskApi.fetchStats).toHaveBeenCalled();

    const summary = screen.getByRole('region', { name: 'Task summary' });
    const values = Array.from(summary.querySelectorAll('.stats__value')).map((node) => node.textContent);
    expect(values).toEqual(['2', '1', '1']); // total, pending, completed
  });

  test('shows the API connection badge once health succeeds', async () => {
    render(<App />);
    expect(await screen.findByText('API connected')).toBeInTheDocument();
  });

  test('shows an empty state when there are no tasks', async () => {
    taskApi.fetchTasks.mockResolvedValue({ tasks: [], meta: { total: 0, count: 0 } });

    render(<App />);

    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
  });

  test('shows an error state when loading fails', async () => {
    taskApi.fetchTasks.mockRejectedValue(new Error('Cannot reach the server.'));

    render(<App />);

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Cannot reach the server.')).toBeInTheDocument();
  });
});

describe('App - creating a task', () => {
  test('calls createTask with the form payload and refreshes the list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Write the API tests');

    // Scope to the "Add a new task" form so the task badges cannot be matched.
    const form = screen.getByRole('heading', { name: /Add a new task/i }).closest('.panel');
    const scope = within(form);

    await user.type(scope.getByLabelText(/Title/i), 'Buy groceries');
    await user.selectOptions(scope.getByLabelText(/Priority/i), 'low');
    await user.clear(scope.getByLabelText(/Category/i));
    await user.type(scope.getByLabelText(/Category/i), 'personal');
    await user.click(scope.getByRole('button', { name: /Add task/i }));

    await waitFor(() => {
      expect(taskApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Buy groceries',
          priority: 'low',
          category: 'personal',
        }),
      );
    });

    // The list is refetched after a successful create.
    await waitFor(() => expect(taskApi.fetchTasks.mock.calls.length).toBeGreaterThan(1));
  });

  test('blocks submission and shows a message when the title is empty', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Write the API tests');

    const form = screen.getByRole('heading', { name: /Add a new task/i }).closest('.panel');
    await user.click(within(form).getByRole('button', { name: /Add task/i }));

    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(taskApi.createTask).not.toHaveBeenCalled();
  });

  test('surfaces a backend validation error returned by the API', async () => {
    const user = userEvent.setup();
    taskApi.createTask.mockRejectedValue(
      Object.assign(new Error('Validation failed'), {
        details: [{ field: 'title', message: 'Title must be at least 2 characters' }],
      }),
    );

    render(<App />);
    await screen.findByText('Write the API tests');

    const form = screen.getByRole('heading', { name: /Add a new task/i }).closest('.panel');
    await user.type(within(form).getByLabelText(/Title/i), 'Buy groceries');
    await user.click(within(form).getByRole('button', { name: /Add task/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('App - completing a task', () => {
  test('calls the toggle endpoint when the checkbox is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Write the API tests');

    const checkbox = screen.getByLabelText(/Mark "Write the API tests" as completed/i);
    await user.click(checkbox);

    await waitFor(() => {
      expect(taskApi.setTaskCompleted).toHaveBeenCalledWith(sampleTasks[0].id, true);
    });
  });

  test('rolls back the checkbox when the request fails', async () => {
    const user = userEvent.setup();
    taskApi.setTaskCompleted.mockRejectedValue(new Error('Cannot reach the server.'));

    render(<App />);
    await screen.findByText('Write the API tests');

    const checkbox = screen.getByLabelText(/Mark "Write the API tests" as completed/i);
    await user.click(checkbox);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Optimistic update was reverted, so the box is unchecked again.
    await waitFor(() => expect(checkbox).not.toBeChecked());
  });
});

describe('App - deleting a task', () => {
  test('calls the delete endpoint after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);
    await screen.findByText('Write the API tests');

    await user.click(screen.getByLabelText(/Delete "Write the API tests"/i));

    await waitFor(() => {
      expect(taskApi.deleteTask).toHaveBeenCalledWith(sampleTasks[0].id);
    });
  });

  test('does not delete when the user cancels the confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<App />);
    await screen.findByText('Write the API tests');

    await user.click(screen.getByLabelText(/Delete "Write the API tests"/i));

    expect(taskApi.deleteTask).not.toHaveBeenCalled();
  });
});

describe('App - editing a task', () => {
  test('loads the task into the form and calls replaceTask on save', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Write the API tests');

    await user.click(screen.getByLabelText(/Edit "Write the API tests"/i));

    // The form switches into edit mode and is prefilled.
    const form = screen.getByRole('heading', { name: /Edit task/i }).closest('.panel');
    const titleInput = within(form).getByLabelText(/Title/i);
    expect(titleInput).toHaveValue('Write the API tests');

    await user.clear(titleInput);
    await user.type(titleInput, 'Write the API tests properly');
    await user.click(within(form).getByRole('button', { name: /Save changes/i }));

    await waitFor(() => {
      expect(taskApi.replaceTask).toHaveBeenCalledWith(
        sampleTasks[0].id,
        expect.objectContaining({ title: 'Write the API tests properly' }),
      );
    });
  });
});

describe('App - searching and filtering', () => {
  test('sends the search term to the API after the debounce', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Write the API tests');

    await user.type(screen.getByPlaceholderText(/Search tasks/i), 'deploy');

    await waitFor(
      () => {
        expect(taskApi.fetchTasks).toHaveBeenCalledWith(expect.objectContaining({ search: 'deploy' }));
      },
      { timeout: 2000 },
    );
  });

  test('sends completed=false when the Pending filter is selected', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Write the API tests');

    await user.click(screen.getByRole('button', { name: 'Pending' }));

    await waitFor(() => {
      expect(taskApi.fetchTasks).toHaveBeenCalledWith(expect.objectContaining({ completed: false }));
    });
  });

  test('sends completed=true when the Completed filter is selected', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Write the API tests');

    await user.click(screen.getByRole('button', { name: 'Completed' }));

    await waitFor(() => {
      expect(taskApi.fetchTasks).toHaveBeenCalledWith(expect.objectContaining({ completed: true }));
    });
  });
});

describe('App - clearing completed tasks', () => {
  test('calls the bulk delete endpoint and shows the count', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);
    await screen.findByText('Write the API tests');

    await user.click(screen.getByRole('button', { name: /Clear completed/i }));

    await waitFor(() => expect(taskApi.deleteCompletedTasks).toHaveBeenCalled());
    expect(await screen.findByText(/1 completed task\(s\) removed/i)).toBeInTheDocument();
  });
});
