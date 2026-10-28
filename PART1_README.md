# Part 1 - Backend API with Node.js, Express.js and MongoDB

Implementation of the REST APIs designed in the previous assignment for the
To-Do List app.

**Stack:** Node.js · Express.js 4 · MongoDB with Mongoose 8 · Joi-free lightweight
custom validation · test runner built into Node (`node --test`) + Supertest.

---

## 1. Setting up the project

```bash
cd backend
npm install
cp .env.example .env
npm run dev          # nodemon, http://localhost:5000
```

Useful scripts:

| Script | Purpose |
| ------ | ------- |
| `npm start` | Run the server once (`node src/server.js`) |
| `npm run dev` | Run with nodemon and auto-restart on changes |
| `npm run dev:memory` | Run against a **throwaway in-memory MongoDB** - no install needed |
| `npm test` | Run the API test suite (in-memory MongoDB) |
| `npm run seed` | Insert sample tasks (`-- --reset` wipes first) |

**Requires Node.js 18+** (developed on Node 24).

---

## 2. Configuring MongoDB

The connection string lives in `MONGODB_URI` in `backend/.env`.

**Option A - local MongoDB**

```
MONGODB_URI=mongodb://127.0.0.1:27017/todoapp
```

**Option B - MongoDB Atlas (cloud)**

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/todoapp?retryWrites=true&w=majority
```

**Option C - no database at all** (for a quick look)

```bash
npm run dev:memory
```

Connection handling lives in `src/config/database.js`:

- The server **connects before listening**, so a bad URI fails immediately
  instead of surfacing on the first request.
- `bufferCommands` is disabled, so a query issued while disconnected fails fast
  with a clear error rather than hanging until timeout.
- The password is masked when the URI is logged.
- `SIGINT` / `SIGTERM` trigger a graceful shutdown that closes the HTTP server and
  the database connection (with a 10 second safety timeout).

### Data model

```js
{
  title:       String,   // required, 2-160 chars, trimmed
  description: String,   // default "", max 1000
  completed:   Boolean,  // default false
  priority:    String,   // enum low | medium | high, default medium
  category:    String,   // default "general", max 60
  dueDate:     Date,     // default null
  createdAt:   Date,     // timestamps: true
  updatedAt:   Date,     // timestamps: true
}
```

**Unique identifier:** the client never sends one. MongoDB generates the
document's `ObjectId`, and `src/utils/serializeTask.js` exposes it as `id` so the
frontend does not need to know about `_id`.

**Indexes:** `{ createdAt: -1 }`, `{ completed: 1, createdAt: -1 }` and a text
index on `title`/`description` cover the queries the UI actually makes.

---

## 3. API logic

| # | Method | Endpoint | Purpose | Success |
| - | ------ | -------- | ------- | ------- |
| 1 | `GET` | `/api/health` | Health + database status | `200` |
| 2 | `POST` | `/api/tasks` | Create a task | `201` |
| 3 | `GET` | `/api/tasks` | List / filter / search / sort / paginate | `200` |
| 4 | `GET` | `/api/tasks/stats` | Total, completed, pending counts | `200` |
| 5 | `GET` | `/api/tasks/:id` | Get one task | `200` |
| 6 | `PUT` | `/api/tasks/:id` | Full update | `200` |
| 7 | `PATCH` | `/api/tasks/:id` | Partial update (toggle completed) | `200` |
| 8 | `DELETE` | `/api/tasks/:id` | Delete one task | `200` |
| 9 | `DELETE` | `/api/tasks?completed=true` | Bulk delete completed tasks | `200` |

**Notes on behaviour**

- **`GET /api/tasks`** accepts `completed`, `priority`, `category`, `search`,
  `sort`, `page`, `limit`. Search terms are regex-escaped so `C++` is treated as
  literal text. Default ordering is pending tasks first, newest first.
- **`PUT`** replaces the resource, so omitted fields fall back to their defaults -
  that is the standard PUT semantic.
- **`PATCH`** touches only the keys present in the body, which is what makes the
  checkbox toggle cheap.
- **`DELETE /api/tasks`** (collection) requires `completed=true|false`; without it
  the request is rejected so a missing parameter can never wipe the collection.
- **Route order:** `/stats` is registered before `/:id`, otherwise Express would
  treat `stats` as an id.

### Response envelope

Every endpoint returns the same shape, produced by `src/utils/apiResponse.js`:

```json
// success
{ "success": true, "message": "Task created successfully", "data": { } }

// list responses add metadata
{ "success": true, "message": "2 task(s) retrieved", "data": [ ],
  "meta": { "count": 2, "total": 2, "page": 1, "limit": 50, "pages": 1 } }

// failure
{ "success": false, "message": "Validation failed", "code": "VALIDATION_ERROR",
  "errors": [ { "field": "title", "message": "Title is required" } ] }
```

---

## 4. Controller / Service / Routes structure

```
request
  -> routes/           URL + HTTP method mapping and middleware wiring
     -> middleware/    validation (validate.js), rate limiting
        -> controllers/  parse request, call service, shape the response
           -> services/    business logic and database access
              -> models/     Mongoose schema
```

| Layer | Folder | Responsibility | Must NOT |
| ----- | ------ | -------------- | -------- |
| Routes | `src/routes/` | Map URLs to controllers, attach validators | Contain logic |
| Controllers | `src/controllers/` | Read validated input, call the service, send JSON | Query the database |
| Services | `src/services/` | Business rules, Mongo queries, throw `ApiError` | Touch `req`/`res` |
| Models | `src/models/` | Schema, indexes, virtuals | Know about HTTP |

**Why this split?**

- Controllers stay a few lines each, so the request flow is obvious at a glance.
- Business logic is testable without starting an HTTP server.
- Swapping the database means changing only the service layer.
- Validation runs *before* the controller, so handlers can trust their inputs and
  never re-implement length or enum checks.

`src/app.js` builds the Express app but never calls `listen()`, which lets the
test suite mount it with Supertest without binding a port. `src/server.js` is the
only file that listens.

---

## 5. Error handling and validation

### Validation (`src/validators/taskValidator.js` + `src/middleware/validate.js`)

Each validator returns `{ data, errors }`:

- **cleaned values** go onto `req.validated` (controllers only ever read from
  there, never the raw body),
- **errors** become a `400` with a `VALIDATION_ERROR` code and a per-field list.

Rules enforced:

| Field | Rule |
| ----- | ---- |
| `title` | required on create/PUT, 2–160 characters, must be a string |
| `description` | string, max 1000 characters |
| `completed` | boolean (accepts `"true"`/`"false"` from query strings) |
| `priority` | one of `low`, `medium`, `high` |
| `category` | string, max 60 characters |
| `dueDate` | parseable date, or `null` to clear |
| unknown keys | rejected, so a typo like `statuss` is reported instead of ignored |

Query parameters are validated too: `page`/`limit` must be positive integers,
`limit` is capped at 100, and `sort` must be a known field. Non-string values are
rejected, which also blocks NoSQL-injection payloads such as `{"$ne": null}`.

Object ids are checked with `src/utils/validateObjectId.js` before any query, so a
malformed id produces `400 INVALID_ID` instead of a Mongoose `CastError` and a 500.

### Centralised error handling (`src/middleware/errorHandler.js`)

`src/utils/ApiError.js` is an operational error carrying a status code, a machine
readable `code` and optional per-field `details`. `asyncHandler` forwards rejected
promises to `next()`, so controllers need no try/catch.

The single error middleware maps anything thrown onto a proper response:

| Thrown | Result |
| ------ | ------ |
| `ApiError` | Its status code and message |
| Mongoose `ValidationError` | `400` with per-field details |
| `CastError` | `400 INVALID_ID` |
| Duplicate key (`11000`) | `409 CONFLICT` |
| Malformed JSON body | `400 INVALID_JSON` |
| `MongooseServerSelectionError` | `503 DB_UNAVAILABLE` |
| Anything else | `500 INTERNAL_ERROR` (details hidden in production) |

Operational errors are logged as warnings; unexpected ones are logged with a stack
trace. A final `notFoundHandler` returns a structured `404` for unknown routes.

Other protective middleware: **helmet** security headers, a configurable **CORS
allow-list**, and **express-rate-limit** (skipped during tests).

---

## 6. Testing with Postman

1. Open Postman -> **Import** -> `postman/To-Do-List-API.postman_collection.json`.
2. Import the environment `postman/To-Do-List-API.postman_environment.json` and
   select it in the top-right dropdown.
3. Set `baseUrl` (default `http://localhost:5000/api`) and, after running
   *Create Task*, the collection stores the returned id in `{{taskId}}`
   automatically for the follow-up requests.

Requests included: health, create, list (with filters), stats, get by id, full
update, partial update, toggle, delete one, bulk delete, plus negative cases
(missing title, invalid id, unknown route).

### Automated tests

```bash
npm test        # 49 tests
```

The suite runs against `mongodb-memory-server`, so it needs no local MongoDB and
never touches real data. It covers: every endpoint, defaults, validation failures,
NoSQL-injection attempts, malformed JSON, invalid and missing ids, filtering,
search (including regex metacharacters), sorting, pagination, bulk delete, the 404
route and the response envelope.

---

## 7. Challenges faced

**Invalid ObjectIds crashing requests.** Sending `/api/tasks/abc` made Mongoose
throw a `CastError` that surfaced as a 500. *Fix:* validate ids with
`mongoose.Types.ObjectId.isValid()` before querying, and also map `CastError` in
the error middleware as a safety net.

**Inconsistent error responses.** Early on each route returned a different shape,
so the frontend had to guess. *Fix:* one response helper for success and one for
failure, plus a single error middleware that normalises everything thrown in the
app.

**`GET /api/tasks/stats` returning 404.** Express matched `stats` as `:id`.
*Fix:* declare static routes before dynamic ones - documented in `taskRoutes.js`
so the trap is not reintroduced.

**Silent query hangs when MongoDB was down.** Mongoose buffers commands by
default, so requests waited instead of failing. *Fix:* `bufferCommands: false`
plus connecting before `listen()`, so a bad URI fails at boot with a readable log.

**Search-as-you-type hammering the API.** Every keystroke fired a request and
slow responses could overwrite newer results. *Fix:* a 350 ms debounce on the
frontend and a request-id guard in `useTasks` so only the latest response applies.

**Dates shifting by a day.** `new Date('2026-11-01')` is parsed as UTC midnight,
which displayed as the previous day in some time zones. *Fix:* the form builds an
explicit ISO timestamp and the backend stores real `Date` objects, so the value
round-trips unchanged.

**Secrets in logs and the repo.** Connection strings would have leaked into logs
and, potentially, version control. *Fix:* `.env` is git-ignored, `.env.example`
documents the variables, and `maskUri()` hides the password before logging.

**Deployment-specific requirements.** A Render container must bind `0.0.0.0` and
shut down cleanly on `SIGTERM`. *Fix:* the server binds `0.0.0.0` and implements a
graceful shutdown with a forced-exit timeout.

---

## 8. Folder map

```
backend/
├── src/
│   ├── config/       env.js, database.js
│   ├── controllers/  taskController.js
│   ├── middleware/   validate.js, errorHandler.js, notFoundHandler.js, rateLimiter.js
│   ├── models/       Task.js
│   ├── routes/       index.js, taskRoutes.js
│   ├── scripts/      seed.js, devMemory.js
│   ├── services/     taskService.js
│   ├── utils/        ApiError.js, apiResponse.js, asyncHandler.js,
│   │                 logger.js, serializeTask.js, validateObjectId.js
│   ├── validators/   taskValidator.js
│   ├── app.js
│   └── server.js
├── test/             api.test.js
├── .env.example
└── package.json
```
