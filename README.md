# To-Do List App - MERN Stack (Task 33)

A fully functional To-Do List application built with the **MERN stack**:
a **React** frontend talking to an **Express.js + MongoDB** REST API.

This repository contains both parts of the assignment:

| Part | Description | Folder |
| ---- | ----------- | ------ |
| **Part 1** | Backend REST API built with Node.js, Express.js and MongoDB (controllers, services, routes, validation, error handling) | [`backend/`](./backend) |
| **Part 2** | React frontend integrated with those APIs using Axios (CRUD, search, filters, sorting, loading states, error handling) | [`frontend/`](./frontend) |

Detailed write-ups live in **[`PART1_README.md`](./PART1_README.md)** and
**[`PART2_README.md`](./PART2_README.md)**.

---

## Table of contents

1. [Features](#features)
2. [Project structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Quick start](#quick-start)
5. [Environment variables](#environment-variables)
6. [API reference](#api-reference)
7. [Running the tests](#running-the-tests)
8. [Example workflows](#example-workflows)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Features

**Backend**

- RESTful CRUD for a single `tasks` resource (8 endpoints).
- Clean layering: **routes → controller → service → model**.
- Request validation with clear per-field error messages.
- Centralised error handling (`ApiError` + one error middleware).
- Consistent JSON response envelope on every endpoint.
- Filtering, full-text search, sorting and pagination on the list endpoint.
- Bulk delete of completed tasks, plus a stats endpoint.
- Security headers (helmet), CORS allow-list, rate limiting, `100 kb` body limit.
- Indexed schema for the queries the UI actually makes.

**Frontend**

- Add, edit, complete/uncomplete and delete tasks.
- Optimistic UI updates with automatic rollback on failure.
- Debounced search, status filters and sorting.
- Live summary (total / pending / completed) and progress bar.
- Loading indicators, empty states, error messages and a toast system.
- API health badge so an unreachable backend is obvious.
- Fully responsive layout, accessible form labels and ARIA attributes.

---

## Project structure

```
DIPAK KALE Task_33/
├── README.md                 <- you are here
├── PART1_README.md           <- backend documentation
├── PART2_README.md           <- frontend integration documentation
├── postman/                  <- Postman collection + environment
├── backend/
│   ├── src/
│   │   ├── config/           env + database connection
│   │   ├── controllers/      HTTP request handling
│   │   ├── middleware/       validation, error handling, 404, rate limiting
│   │   ├── models/           Mongoose schema
│   │   ├── routes/           Express routers
│   │   ├── scripts/          seed + in-memory dev server
│   │   ├── services/         business logic / database access
│   │   ├── utils/            ApiError, asyncHandler, response envelope, logger
│   │   ├── validators/       request validation rules
│   │   ├── app.js            express app (no listen)
│   │   └── server.js         bootstrap: connect DB then listen
│   ├── test/                 node:test + supertest API tests
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/              axios client + endpoint functions
    │   ├── components/       TaskForm, TaskItem, TaskList, TaskToolbar, ...
    │   ├── hooks/            useTasks, useStats, useApiHealth
    │   ├── styles/           stylesheet
    │   ├── constants.js      shared options + date helpers
    │   ├── App.jsx
    │   └── main.jsx
    ├── test/                 Vitest + React Testing Library tests
    ├── .env.example
    └── package.json
```

---

## Prerequisites

- **Node.js 18 or newer** (built with Node 24) and npm.
- A **MongoDB** database. Any one of:
  - **MongoDB Atlas** (free tier) - recommended, nothing to install,
  - a **local** MongoDB server,
  - **no database at all** - `npm run dev:memory` starts a throwaway in-memory
    MongoDB so you can try everything immediately.

---

## Quick start

Open **two terminals**.

### Terminal 1 - backend

```bash
cd backend
cp .env.example .env      # then set MONGODB_URI
npm install

# Pick ONE:
npm run dev               # uses the MONGODB_URI from .env
npm run dev:memory        # zero-config: starts an in-memory MongoDB
```

The API starts on <http://localhost:5000>. Verify it:

```bash
curl http://localhost:5000/api/health
```

### Terminal 2 - frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>.

> The Vite dev server proxies `/api/*` to `http://localhost:5000` (see
> `frontend/vite.config.js`), so the frontend uses relative URLs and **CORS is
> not needed in development at all**.

### Optional - sample data

With a real database configured, seed some demo tasks:

```bash
cd backend
npm run seed -- --reset
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `5000` | Port the API listens on |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/todoapp` | MongoDB connection string (local **or** Atlas) |
| `CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed origins. Leave empty to allow all (development only) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX` | `300` | Max requests per IP per window |

**Local MongoDB**

```
MONGODB_URI=mongodb://127.0.0.1:27017/todoapp
```

**MongoDB Atlas**

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/todoapp?retryWrites=true&w=majority
```

Remember to whitelist your IP (or `0.0.0.0/0` for a hosted deployment) in the
Atlas dashboard.

### Frontend (`frontend/.env`)

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `VITE_API_URL` | `/api` | Base URL of the API. Use `/api` behind the dev proxy, or a full URL such as `https://your-api.onrender.com/api` |
| `VITE_PROXY_TARGET` | `http://localhost:5000` | Where the dev server forwards `/api` requests |

> Only variables prefixed with `VITE_` are visible to the browser. Never put
> secrets in the frontend `.env`.

---

## API reference

Base URL: `/api` · All request and response bodies are JSON.

### Response envelope

Every response follows one of these two shapes:

```json
{ "success": true,  "message": "Task created successfully", "data": { } }
```

```json
{ "success": false, "message": "Validation failed", "code": "VALIDATION_ERROR",
  "errors": [ { "field": "title", "message": "Title is required" } ] }
```

### Endpoints

| Method | Endpoint | Description | Success |
| ------ | -------- | ----------- | ------- |
| `GET` | `/api/health` | Service + database health | `200` |
| `POST` | `/api/tasks` | Create a task | `201` |
| `GET` | `/api/tasks` | List tasks (filter/search/sort/page) | `200` |
| `GET` | `/api/tasks/stats` | Total / completed / pending counts | `200` |
| `GET` | `/api/tasks/:id` | Get a single task | `200` |
| `PUT` | `/api/tasks/:id` | Full update | `200` |
| `PATCH` | `/api/tasks/:id` | Partial update (e.g. toggle completed) | `200` |
| `DELETE` | `/api/tasks/:id` | Delete one task | `200` |
| `DELETE` | `/api/tasks?completed=true` | Delete all completed tasks | `200` |

### Task fields

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `id` | string | auto | MongoDB ObjectId, generated by the server |
| `title` | string | **yes** | 2–160 characters |
| `description` | string | no | up to 1000 characters, default `""` |
| `completed` | boolean | no | default `false` |
| `priority` | string | no | `low` \| `medium` \| `high`, default `medium` |
| `category` | string | no | up to 60 characters, default `general` |
| `dueDate` | ISO date | no | default `null` |
| `createdAt` / `updatedAt` | ISO date | auto | managed by Mongoose timestamps |
| `isOverdue` | boolean | auto | read-only virtual: past due and not completed |

### Query parameters for `GET /api/tasks`

| Param | Example | Description |
| ----- | ------- | ----------- |
| `completed` | `?completed=false` | Filter by completion status |
| `priority` | `?priority=high` | Filter by priority |
| `category` | `?category=work` | Filter by category |
| `search` | `?search=report` | Case-insensitive text search on title/description/category |
| `sort` | `?sort=-createdAt` | `createdAt`, `updatedAt`, `dueDate`, `title`, `priority`, `completed`. Prefix `-` for descending |
| `page` | `?page=2` | Page number (default `1`) |
| `limit` | `?limit=10` | Items per page (default `50`, max `100`) |

### Status codes

| Code | Meaning |
| ---- | ------- |
| `200` | OK |
| `201` | Created |
| `400` | Validation failed, malformed JSON or invalid id |
| `404` | Task or route not found |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `503` | Database unavailable |

### Examples

**Create**

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Finish the MERN assignment",
    "description": "Write the README and deploy",
    "priority": "high",
    "category": "study",
    "dueDate": "2026-11-01T18:00:00.000Z"
  }'
```

**List pending, highest priority first**

```bash
curl "http://localhost:5000/api/tasks?completed=false&sort=-priority&limit=10"
```

**Toggle completion**

```bash
curl -X PATCH http://localhost:5000/api/tasks/<id> \
  -H "Content-Type: application/json" -d '{"completed": true}'
```

**Delete all completed**

```bash
curl -X DELETE "http://localhost:5000/api/tasks?completed=true"
```

A ready-to-import **Postman collection** is in [`postman/`](./postman).

---

## Running the tests

### Backend - 49 tests

```bash
cd backend
npm test
```

Uses `node --test` + `supertest` against a **temporary in-memory MongoDB**
(`mongodb-memory-server`), so no local database is required and your real data is
never touched. Covers every endpoint plus validation, id handling, filtering,
sorting, pagination, error envelopes and the 404 route.

### Frontend - 27 tests

```bash
cd frontend
npm test
```

Uses Vitest + React Testing Library with the API module mocked, verifying that the
UI calls the right endpoints with the right payloads and renders backend data,
including optimistic updates and rollback on failure.

---

## Example workflows

**Add a task** - type a title, choose priority/category/date, press *Add task*.
The frontend sends `POST /api/tasks`, then refetches the list and the stats.

**Complete a task** - click the checkbox. The UI flips immediately (optimistic),
sends `PATCH /api/tasks/:id { completed }`, and rolls back if the request fails.

**Edit a task** - press ✏️. The form switches into edit mode, sends
`PUT /api/tasks/:id` with the full payload, and returns to "add" mode on success.

**Delete a task** - press 🗑️ and confirm. Sends `DELETE /api/tasks/:id` and
removes the row optimistically.

**Search / filter / sort** - the toolbar sends `search`, `completed` and `sort`
query parameters. Searching is debounced by 350 ms.

**Clear completed** - the button appears only when completed tasks exist and calls
`DELETE /api/tasks?completed=true`.

---

## Deployment

### Backend → Render

1. Push the repository to GitHub.
2. On Render: **New → Web Service**, connect the repo.
3. Settings:
   - **Root directory:** `backend`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment:** Node
4. Environment variables:
   - `MONGODB_URI` = your Atlas connection string
   - `CORS_ORIGIN` = `https://<your-netlify-site>.netlify.app`
   - `NODE_ENV` = `production`
5. Deploy, then confirm `https://<your-service>.onrender.com/api/health`.

> The service binds `0.0.0.0` and handles `SIGTERM`, which is what Render expects.
> Free instances sleep when idle, so the first request can take a few seconds.

### Frontend → Netlify

1. On Netlify: **Add new site → Import an existing project**.
2. Settings:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`
3. Environment variable:
   - `VITE_API_URL` = `https://<your-service>.onrender.com/api`
4. Deploy.

A `frontend/public/_redirects` file is included so client-side routes do not 404.

> **Order matters:** deploy the backend first so you know its URL, then set
> `VITE_API_URL` on Netlify and `CORS_ORIGIN` on Render.

---

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| Badge says **API offline** | Backend not running, wrong `VITE_API_URL`, or blocked by CORS |
| `Cannot reach the server` in the UI | Same as above; check the browser console for the failed request |
| CORS error in the console | Add the frontend origin to `CORS_ORIGIN` on the backend and restart |
| `503 Database unavailable` | MongoDB unreachable - check `MONGODB_URI`, the Atlas IP allow-list, or start local MongoDB |
| `MongooseServerSelectionError` at boot | Same as above; the server exits deliberately rather than serving broken requests |
| `429 Too many requests` | Rate limit hit; raise `RATE_LIMIT_MAX` or wait for the window to reset |
| Blank page after deploy | `VITE_API_URL` missing on Netlify, or the publish directory is wrong |
| Changes to `.env` have no effect | Restart the dev server - Vite/Node read env vars only at startup |
| `npm test` fails to download MongoDB | `mongodb-memory-server` needs internet on first run; afterwards it is cached |
| `mongodb-memory-server` fails with `fassert()` | Not enough free disk space - MongoDB needs a few hundred MB of headroom. Free some space and rerun |
| `npm test` hangs or times out connecting | The in-memory MongoDB could not start; check disk space and that no stale `mongod` process is holding the port |

---

## License

MIT - created for educational purposes as part of a MERN stack course.
