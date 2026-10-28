# To-Do List API

Backend for the To-Do List app - **Node.js + Express.js + MongoDB (Mongoose)**.

A small, RESTful API built with a clean **routes -> controller -> service -> model**
layering, centralised error handling, request validation and a consistent JSON
envelope on every response.

Full setup / architecture notes: see [`../README.md`](../README.md) and
[`../PART1_README.md`](../PART1_README.md).

## Quick start

```bash
cp .env.example .env      # then edit MONGODB_URI if needed
npm install
npm run dev               # http://localhost:5000
```

## Endpoints

| Method | Endpoint                    | Description                          |
| ------ | --------------------------- | ------------------------------------ |
| GET    | `/api/health`               | Health / uptime probe                |
| POST   | `/api/tasks`                | Create a task                        |
| GET    | `/api/tasks`                | List tasks (filter, search, sort, page) |
| GET    | `/api/tasks/stats`          | Task counts                          |
| GET    | `/api/tasks/:id`            | Get one task                         |
| PUT    | `/api/tasks/:id`            | Full update                          |
| PATCH  | `/api/tasks/:id`            | Partial update / toggle complete      |
| DELETE | `/api/tasks/:id`            | Delete one task                      |
| DELETE | `/api/tasks?completed=true` | Delete all completed tasks           |

Query params for `GET /api/tasks`: `completed`, `priority`, `category`, `search`,
`sort`, `page`, `limit`.

## Project layout

```
backend/
  src/
    config/       # env loading + database connection
    models/       # Mongoose schema (data model)
    validators/   # request validation rules
    services/     # business logic / database access
    controllers/  # HTTP request handlers
    routes/       # Express routers
    middleware/   # error handling, 404, validation, rate limit
    utils/        # ApiError, asyncHandler, response envelope, logger
    scripts/      # database seed script
    app.js        # express app (no listen)
    server.js     # bootstrap: connect DB then listen
  test/           # node:test + supertest API tests
```

## Testing

```bash
npm test
```
