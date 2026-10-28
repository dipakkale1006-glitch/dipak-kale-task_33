import { useState } from 'react';
import { PRIORITIES } from '../constants';

/**
 * TaskForm - used both for creating and for editing a task.
 *
 * One component for both flows keeps the validation rules and the field layout
 * identical, which means the data the API receives is shaped the same way in
 * either case.
 *
 * @param {object}   props
 * @param {object}   [props.initialValues] Existing task when editing
 * @param {Function} props.onSubmit        Called with the cleaned payload
 * @param {Function} [props.onCancel]      Shown when editing
 * @param {boolean}  [props.submitting]    Disables the form while a request runs
 */
export default function TaskForm({ initialValues, onSubmit, onCancel, submitting = false }) {
  const isEditing = Boolean(initialValues);

  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [priority, setPriority] = useState(initialValues?.priority ?? 'medium');
  const [category, setCategory] = useState(initialValues?.category ?? 'general');
  const [dueDate, setDueDate] = useState(
    // An <input type="date"> needs `YYYY-MM-DD`, not a full ISO timestamp.
    initialValues?.dueDate ? initialValues.dueDate.slice(0, 10) : '',
  );
  const [fieldErrors, setFieldErrors] = useState({});

  /** Client side checks mirror the backend rules so obvious mistakes never leave the browser. */
  function validate() {
    const errors = {};
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      errors.title = 'Title is required';
    } else if (trimmedTitle.length < 2) {
      errors.title = 'Title must be at least 2 characters';
    } else if (trimmedTitle.length > 160) {
      errors.title = 'Title cannot exceed 160 characters';
    }

    if (description.length > 1000) {
      errors.description = 'Description cannot exceed 1000 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      category: category.trim() || 'general',
      // Send an ISO string; the backend validates and stores it as a Date.
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
    });

    if (!isEditing) {
      // Reset so the user can add the next task straight away.
      setTitle('');
      setDescription('');
      setPriority('medium');
      setCategory('general');
      setDueDate('');
      setFieldErrors({});
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <div className="task-form__row">
        <label className="task-form__field task-form__field--grow">
          <span className="task-form__label">
            Title <span className="task-form__required">*</span>
          </span>
          <input
            type="text"
            name="title"
            value={title}
            placeholder="What needs to be done?"
            maxLength={160}
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors.title)}
            onChange={(event) => setTitle(event.target.value)}
          />
          {fieldErrors.title && <span className="task-form__error">{fieldErrors.title}</span>}
        </label>

        <label className="task-form__field">
          <span className="task-form__label">Priority</span>
          <select
            name="priority"
            value={priority}
            disabled={submitting}
            onChange={(event) => setPriority(event.target.value)}
          >
            {PRIORITIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="task-form__field">
          <span className="task-form__label">Category</span>
          <input
            type="text"
            name="category"
            value={category}
            placeholder="general"
            maxLength={60}
            disabled={submitting}
            onChange={(event) => setCategory(event.target.value)}
          />
        </label>

        <label className="task-form__field">
          <span className="task-form__label">Due date</span>
          <input
            type="date"
            name="dueDate"
            value={dueDate}
            disabled={submitting}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
      </div>

      <label className="task-form__field">
        <span className="task-form__label">Description</span>
        <textarea
          name="description"
          value={description}
          placeholder="Optional details..."
          rows={2}
          maxLength={1000}
          disabled={submitting}
          onChange={(event) => setDescription(event.target.value)}
        />
        {fieldErrors.description && <span className="task-form__error">{fieldErrors.description}</span>}
      </label>

      <div className="task-form__actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Add task'}
        </button>

        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
