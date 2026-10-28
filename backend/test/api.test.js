'use strict';

/**
 * API test suite.
 *
 * Uses `node --test` (built into Node 18+) plus `supertest` to exercise the
 * Express app over real HTTP, and `mongodb-memory-server` to run a throwaway
 * in-memory MongoDB. That means the suite needs no local database and never
 * touches real data:
 *
 *   npm test
 */

// Must be set before the app (and its config module) is required.
process.env.NODE_ENV = 'test';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../src/app');
const Task = require('../src/models/Task');

let mongoServer;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'todoapp_test' });
  // Create the indexes declared on the schema so text search behaves as in prod.
  await Task.syncIndexes();
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Task.deleteMany({});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validTask = {
  title: 'Write the integration tests',
  description: 'Cover every CRUD endpoint with supertest',
  priority: 'high',
  category: 'study',
};

async function createTask(overrides = {}) {
  const response = await request(app).post('/api/tasks').send({ ...validTask, ...overrides });
  assert.equal(response.status, 201, 'helper expected a successful create');
  return response.body.data;
}

describe('Health check', () => {
  test('GET /api/health reports the service is running', async () => {
    const response = await request(app).get('/api/health');

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.status, 'ok');
  });

  test('GET /api/health reports the database is connected in tests', async () => {
    const response = await request(app).get('/api/health');
    assert.equal(response.body.data.database, 'connected');
  });
});

describe('POST /api/tasks (Create)', () => {
  test('creates a task and returns 201 with a generated id', async () => {
    const response = await request(app).post('/api/tasks').send(validTask);

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(response.body.message, 'Task created successfully');
    assert.ok(response.body.data.id, 'expected the server to generate an id');
    assert.match(response.body.data.id, /^[0-9a-f]{24}$/, 'id should be a Mongo ObjectId');
    assert.equal(response.body.data.completed, false, 'completed defaults to false');
    assert.equal(response.body.data.title, validTask.title);
  });

  test('applies defaults for omitted optional fields', async () => {
    const response = await request(app).post('/api/tasks').send({ title: 'Minimal task' });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.priority, 'medium');
    assert.equal(response.body.data.category, 'general');
    assert.equal(response.body.data.description, '');
    assert.equal(response.body.data.dueDate, null);
  });

  test('accepts an ISO due date and echoes it back', async () => {
    const dueDate = '2026-12-31T18:00:00.000Z';
    const response = await request(app).post('/api/tasks').send({ title: 'Task with date', dueDate });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.dueDate, dueDate);
  });

  test('rejects a missing title with 400 and field details', async () => {
    const response = await request(app).post('/api/tasks').send({ description: 'no title here' });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, 'VALIDATION_ERROR');
    assert.ok(response.body.errors.some((error) => error.field === 'title'));
  });

  test('rejects an empty title', async () => {
    const response = await request(app).post('/api/tasks').send({ title: '   ' });
    assert.equal(response.status, 400);
  });

  test('rejects a title shorter than two characters', async () => {
    const response = await request(app).post('/api/tasks').send({ title: 'a' });
    assert.equal(response.status, 400);
  });

  test('rejects an invalid priority', async () => {
    const response = await request(app).post('/api/tasks').send({ title: 'Bad priority', priority: 'urgent' });
    assert.equal(response.status, 400);
    assert.ok(response.body.errors.some((error) => error.field === 'priority'));
  });

  test('rejects a non-boolean completed flag', async () => {
    const response = await request(app).post('/api/tasks').send({ title: 'Bad flag', completed: 'yes-please' });
    assert.equal(response.status, 400);
    assert.ok(response.body.errors.some((error) => error.field === 'completed'));
  });

  test('rejects an invalid date', async () => {
    const response = await request(app).post('/api/tasks').send({ title: 'Bad date', dueDate: 'not-a-date' });
    assert.equal(response.status, 400);
  });

  test('rejects unsupported fields to catch typos', async () => {
    const response = await request(app).post('/api/tasks').send({ title: 'Typo field', statuss: 'done' });
    assert.equal(response.status, 400);
    assert.ok(response.body.errors.some((error) => error.field === 'statuss'));
  });

  test('guards against NoSQL injection payloads in the title', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: { $ne: null } });

    assert.equal(response.status, 400);
  });

  test('returns 400 for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": "broken"');

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_JSON');
  });
});

describe('GET /api/tasks (Read list)', () => {
  test('returns an empty array when there are no tasks', async () => {
    const response = await request(app).get('/api/tasks');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
    assert.equal(response.body.meta.total, 0);
  });

  test('returns every task with pagination metadata', async () => {
    await createTask({ title: 'First task' });
    await createTask({ title: 'Second task' });

    const response = await request(app).get('/api/tasks');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
    assert.equal(response.body.meta.total, 2);
    assert.equal(response.body.meta.page, 1);
  });

  test('filters by completed status', async () => {
    await createTask({ title: 'Pending task' });
    await createTask({ title: 'Done task', completed: true });

    const completed = await request(app).get('/api/tasks?completed=true');
    const pending = await request(app).get('/api/tasks?completed=false');

    assert.equal(completed.body.data.length, 1);
    assert.equal(completed.body.data[0].title, 'Done task');
    assert.equal(pending.body.data.length, 1);
    assert.equal(pending.body.data[0].title, 'Pending task');
  });

  test('filters by priority and category', async () => {
    await createTask({ title: 'High work', priority: 'high', category: 'work' });
    await createTask({ title: 'Low personal', priority: 'low', category: 'personal' });

    const high = await request(app).get('/api/tasks?priority=high');
    const work = await request(app).get('/api/tasks?category=work');

    assert.equal(high.body.data.length, 1);
    assert.equal(high.body.data[0].title, 'High work');
    assert.equal(work.body.data.length, 1);
  });

  test('searches title and description case-insensitively', async () => {
    await createTask({ title: 'Buy milk' });
    await createTask({ title: 'Read a book', description: 'Chapter about milk production' });
    await createTask({ title: 'Call the plumber' });

    const response = await request(app).get('/api/tasks?search=MILK');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
  });

  test('treats regex metacharacters in the search term as literal text', async () => {
    await createTask({ title: 'C++ practice' });
    await createTask({ title: 'Plain task' });

    const response = await request(app).get('/api/tasks?search=C%2B%2B');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].title, 'C++ practice');
  });

  test('sorts by title ascending and descending', async () => {
    await createTask({ title: 'Banana' });
    await createTask({ title: 'Apple' });

    const asc = await request(app).get('/api/tasks?sort=title');
    const desc = await request(app).get('/api/tasks?sort=-title');

    assert.equal(asc.body.data[0].title, 'Apple');
    assert.equal(desc.body.data[0].title, 'Banana');
  });

  test('paginates results', async () => {
    for (let index = 1; index <= 5; index++) {
      await createTask({ title: `Task number ${index}` });
    }

    const page1 = await request(app).get('/api/tasks?page=1&limit=2');
    const page2 = await request(app).get('/api/tasks?page=2&limit=2');

    assert.equal(page1.body.data.length, 2);
    assert.equal(page2.body.data.length, 2);
    assert.equal(page1.body.meta.pages, 3);
    assert.notEqual(page1.body.data[0].id, page2.body.data[0].id);
  });

  test('places pending tasks before completed ones by default', async () => {
    await createTask({ title: 'Finished', completed: true });
    await createTask({ title: 'Still pending' });

    const response = await request(app).get('/api/tasks');
    assert.equal(response.body.data[0].title, 'Still pending');
  });

  test('rejects a limit above the maximum', async () => {
    const response = await request(app).get('/api/tasks?limit=5000');
    assert.equal(response.status, 400);
    assert.ok(response.body.errors.some((error) => error.field === 'limit'));
  });

  test('rejects an unknown sort field', async () => {
    const response = await request(app).get('/api/tasks?sort=password');
    assert.equal(response.status, 400);
  });

  test('rejects a negative page number', async () => {
    const response = await request(app).get('/api/tasks?page=-3');
    assert.equal(response.status, 400);
  });
});

describe('GET /api/tasks/stats', () => {
  test('returns totals, completed and pending counts', async () => {
    await createTask({ title: 'One' });
    await createTask({ title: 'Two', completed: true });
    await createTask({ title: 'Three', completed: true });

    const response = await request(app).get('/api/tasks/stats');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, { total: 3, completed: 2, pending: 1 });
  });

  test('returns zeroes when the collection is empty', async () => {
    const response = await request(app).get('/api/tasks/stats');
    assert.deepEqual(response.body.data, { total: 0, completed: 0, pending: 0 });
  });
});

describe('GET /api/tasks/:id (Read one)', () => {
  test('returns the requested task', async () => {
    const created = await createTask({ title: 'Find me' });

    const response = await request(app).get(`/api/tasks/${created.id}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, created.id);
    assert.equal(response.body.data.title, 'Find me');
  });

  test('returns 404 for a well formed id that does not exist', async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    const response = await request(app).get(`/api/tasks/${missingId}`);

    assert.equal(response.status, 404);
    assert.equal(response.body.code, 'NOT_FOUND');
  });

  test('returns 400 for a malformed id instead of crashing', async () => {
    const response = await request(app).get('/api/tasks/not-a-valid-id');

    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'INVALID_ID');
  });
});

describe('PUT /api/tasks/:id (Full update)', () => {
  test('replaces the editable fields and returns the updated task', async () => {
    const created = await createTask({ title: 'Original title', priority: 'low' });

    const response = await request(app)
      .put(`/api/tasks/${created.id}`)
      .send({ title: 'Replaced title', description: 'New description', priority: 'high', completed: true });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.title, 'Replaced title');
    assert.equal(response.body.data.priority, 'high');
    assert.equal(response.body.data.completed, true);
  });

  test('resets fields that were omitted, matching PUT semantics', async () => {
    const created = await createTask({ title: 'Has a category', category: 'work', priority: 'high' });

    const response = await request(app).put(`/api/tasks/${created.id}`).send({ title: 'Only a title' });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.category, 'general');
    assert.equal(response.body.data.priority, 'medium');
    assert.equal(response.body.data.completed, false);
  });

  test('requires a title', async () => {
    const created = await createTask();
    const response = await request(app).put(`/api/tasks/${created.id}`).send({ description: 'no title' });
    assert.equal(response.status, 400);
  });

  test('returns 404 for a missing task', async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    const response = await request(app).put(`/api/tasks/${missingId}`).send({ title: 'Nope' });
    assert.equal(response.status, 404);
  });
});

describe('PATCH /api/tasks/:id (Partial update)', () => {
  test('toggles completed without touching other fields', async () => {
    const created = await createTask({ title: 'Toggle me', priority: 'high', category: 'work' });

    const response = await request(app).patch(`/api/tasks/${created.id}`).send({ completed: true });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.completed, true);
    assert.equal(response.body.data.title, 'Toggle me');
    assert.equal(response.body.data.priority, 'high');
  });

  test('updates a single field such as priority', async () => {
    const created = await createTask({ priority: 'low' });

    const response = await request(app).patch(`/api/tasks/${created.id}`).send({ priority: 'high' });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.priority, 'high');
  });

  test('clears a due date when null is sent', async () => {
    const created = await createTask({ dueDate: '2026-12-31T18:00:00.000Z' });

    const response = await request(app).patch(`/api/tasks/${created.id}`).send({ dueDate: null });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.dueDate, null);
  });

  test('rejects an empty body', async () => {
    const created = await createTask();
    const response = await request(app).patch(`/api/tasks/${created.id}`).send({});
    assert.equal(response.status, 400);
  });

  test('rejects an invalid field value', async () => {
    const created = await createTask();
    const response = await request(app).patch(`/api/tasks/${created.id}`).send({ completed: 'maybe' });
    assert.equal(response.status, 400);
  });

  test('returns 404 for a missing task', async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    const response = await request(app).patch(`/api/tasks/${missingId}`).send({ completed: true });
    assert.equal(response.status, 404);
  });
});

describe('DELETE /api/tasks/:id (Delete one)', () => {
  test('deletes the task and confirms with its id', async () => {
    const created = await createTask({ title: 'Delete me' });

    const response = await request(app).delete(`/api/tasks/${created.id}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, created.id);

    const check = await request(app).get(`/api/tasks/${created.id}`);
    assert.equal(check.status, 404, 'task should no longer exist');
  });

  test('returns 404 when deleting a task twice', async () => {
    const created = await createTask();

    const first = await request(app).delete(`/api/tasks/${created.id}`);
    const second = await request(app).delete(`/api/tasks/${created.id}`);

    assert.equal(first.status, 200);
    assert.equal(second.status, 404);
  });

  test('returns 400 for a malformed id', async () => {
    const response = await request(app).delete('/api/tasks/123');
    assert.equal(response.status, 400);
  });
});

describe('DELETE /api/tasks?completed=true (Bulk delete)', () => {
  test('removes only the matching tasks and reports the count', async () => {
    await createTask({ title: 'Done 1', completed: true });
    await createTask({ title: 'Done 2', completed: true });
    await createTask({ title: 'Pending 1' });

    const response = await request(app).delete('/api/tasks?completed=true');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.count, 2);

    const remaining = await request(app).get('/api/tasks');
    assert.equal(remaining.body.data.length, 1);
    assert.equal(remaining.body.data[0].title, 'Pending 1');
  });

  test('reports zero when nothing matches', async () => {
    await createTask({ title: 'Still pending' });

    const response = await request(app).delete('/api/tasks?completed=true');

    assert.equal(response.status, 200);
    assert.equal(response.body.data.count, 0);
  });

  test('requires the completed query parameter', async () => {
    const response = await request(app).delete('/api/tasks');
    assert.equal(response.status, 400);
    assert.ok(response.body.errors.some((error) => error.field === 'completed'));
  });
});

describe('Unknown routes', () => {
  test('returns a structured 404 for an unmatched route', async () => {
    const response = await request(app).get('/api/does-not-exist');

    assert.equal(response.status, 404);
    assert.equal(response.body.success, false);
    assert.equal(response.body.code, 'NOT_FOUND');
  });
});

describe('Response envelope', () => {
  test('every success response includes success, message and data', async () => {
    const created = await createTask();

    const responses = await Promise.all([
      request(app).get('/api/tasks'),
      request(app).get(`/api/tasks/${created.id}`),
      request(app).get('/api/tasks/stats'),
    ]);

    responses.forEach((response) => {
      assert.equal(response.body.success, true);
      assert.equal(typeof response.body.message, 'string');
      assert.ok(Object.prototype.hasOwnProperty.call(response.body, 'data'));
    });
  });
});

