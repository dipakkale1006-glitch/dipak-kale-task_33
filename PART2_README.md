# Part 2 - Integrating the To-Do List API with the React Frontend

How the React app was wired to the Express + MongoDB backend so the To-Do List is
a fully functional, end-to-end application.

**Stack:** React 18 · Vite 5 · Axios · Vitest + React Testing Library.

---

## 1. Packages installed

```bash
cd frontend
npm install                     # react, react-dom, axios
npm install -D vitest @testing-library/react @testing-library/jest-dom \
               @testing-library/user-event jsdom
```

| Package | Why |
| ------- | --- |
| `axios` | HTTP client with interceptors, timeouts and a clean error object |
| `vite` | Dev server with a proxy and a fast production build |
| `vitest` + Testing Library | Component tests with the API mocked |

---

## 2. Integrating the API calls

### The Axios client (`src/api/client.js`)

One configured instance owns the base URL, a 15 second timeout and the JSON
headers, so no component repeats them:

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});
```

A **response interceptor** is what makes the rest of the app simple - it converts
every Axios failure into a predictable `Error` with a friendly `message` and the
backend's per-field `details`, so components never inspect `error.response.status`:

```js
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normaliseError(error)),
);
```

`normaliseError` distinguishes the useful cases: cancelled requests, timeouts
(`ECONNABORTED`), backend errors (using the API's `message` + `errors`) and a
completely unreachable server.

### The API module (`src/api/taskApi.js`)

One small function per endpoint - the single place that knows the URLs and payload
shapes:

| Function | Request | Used by |
| -------- | ------- | ------- |
| `fetchTasks(params)` | `GET /api/tasks` | list, search, filter, sort |
| `fetchTaskById(id)` | `GET /api/tasks/:id` | detail reads |
| `createTask(payload)` | `POST /api/tasks` | add task |
| `replaceTask(id, payload)` | `PUT /api/tasks/:id` | edit form save |
| `updateTask(id, payload)` | `PATCH /api/tasks/:id` | partial edits |
| `setTaskCompleted(id, completed)` | `PATCH /api/tasks/:id` | checkbox toggle |
| `deleteTask(id)` | `DELETE /api/tasks/:id` | delete one |
| `deleteCompletedTasks()` | `DELETE /api/tasks?completed=true` | clear completed |
| `fetchStats()` | `GET /api/tasks/stats` | summary bar |
| `checkHealth()` | `GET /api/health` | connection badge |

### State management (`src/hooks/useTasks.js`)

Rather than spreading `useState`/`useEffect` across components, all task data
lives in one custom hook. It exposes `tasks`, `meta`, `loading`, `error`,
`busyIds` and the actions `addTask`, `editTask`, `toggleTask`, `removeTask`,
`clearCompleted`, `reload`.

Two details make the UI feel solid:

1. **Debounced reloads** - the list refetches 350 ms after typing stops, so a
   search does not fire one request per keystroke.
2. **Request-id guard** - each fetch records an id and only the newest response is
   applied, so a slow early request cannot overwrite a newer result.

Supporting hooks: `useStats` (summary numbers, refreshable) and `useApiHealth`
(polls `/api/health` every 30 s for the connection badge).

### Cross-origin handling

The Vite dev server proxies `/api` to the backend (`frontend/vite.config.js`), so
the frontend can use relative URLs exactly like it would behind a reverse proxy:

```js
server: {
  proxy: {
    '/api': { target: 'http://localhost:5000', changeOrigin: true },
  },
}
```

This means **no CORS configuration is needed in development**. In production the
frontend calls the deployed API directly via `VITE_API_URL`, and the backend's
`CORS_ORIGIN` allow-list covers that origin.

---

## 3. Dynamic UI

- The list renders from `tasks`, which always comes from the API - there is no
  duplicated client-side copy of the data.
- Every mutation refetches the list and the stats, so the UI can never drift from
  the database.
- **Optimistic updates:** the checkbox flips and rows disappear immediately, and
  `useTasks` keeps the previous array to **roll back** if the request fails.
- `busyIds` marks the task(s) currently mid-request, which dims them and disables
  their controls so a double-click cannot fire two conflicting requests.
- The connection badge reflects `/api/health`, so an unreachable backend is
  visible before the user tries anything.
- The empty state distinguishes "no tasks yet" from "nothing matches your
  filters" - the second case is confusing without an explanation.

### Components

| Component | Role |
| --------- | ---- |
| `TaskForm` | Add **and** edit form (shared validation + layout) |
| `TaskList` | Renders the collection or the right empty state |
| `TaskItem` | One row: checkbox, badges, due date, edit/delete buttons |
| `TaskToolbar` | Search box, status chips, sort dropdown |
| `TaskStats` | Total/pending/completed counts and a progress bar |
| `Feedback.jsx` | `Toast`, `LoadingState`, `ErrorState`, `ConnectionBadge` |

---

## 4. User interaction

| Interaction | What happens |
| ----------- | ------------ |
| Add task | Validates in the browser -> `POST /api/tasks` -> refetch list + stats -> success toast |
| Complete/uncomplete | Optimistic flip -> `PATCH /api/tasks/:id { completed }` -> rollback on failure |
| Edit task | Form switches to edit mode, prefilled -> `PUT /api/tasks/:id` -> returns to add mode |
| Delete task | `window.confirm` -> optimistic removal -> `DELETE /api/tasks/:id` |
| Clear completed | Confirmation -> `DELETE /api/tasks?completed=true` -> reports how many were removed |
| Search | Debounced `search` query parameter |
| Filter | `completed=true/false` query parameter |
| Sort | `sort=-createdAt` style query parameter |
| Retry | Error state and badge both trigger a recheck + reload |

The layout is responsive down to phone widths (the toolbar wraps, form fields go
full width, task action buttons stack), and form inputs are wrapped in real
`<label>` elements with `aria-invalid`, `aria-pressed` and `role="alert"`
attributes where appropriate.

---

## 5. Error handling on the frontend

- **Client-side validation** mirrors the backend rules, so an empty or one
  character title never leaves the browser.
- **Backend validation errors** are surfaced verbatim: the interceptor lifts the
  per-field messages out of the API's error envelope and the toast shows them.
- **Network failures** produce a readable message rather than a stack trace.
- **Rollback** keeps the UI truthful: if a mutation fails, the optimistic change
  is reverted and a toast explains why.
- **Errors from unrelated actions cannot break the page** - a stats failure is
  intentionally swallowed because the list is still perfectly usable.
- `.catch()` on every API call means no unhandled promise rejections.

---

## 6. Testing

```bash
cd frontend
npm test        # 27 tests
```

`test/App.test.jsx` mocks `src/api/taskApi.js` and asserts the integration
contract - the right endpoint is called with the right payload, and the UI renders
what the backend returns. Covered: loading tasks, stats, the connection badge,
empty state, error state, create (including client-side and backend validation
errors), toggle success and rollback, delete with confirm/cancel, edit mode,
debounced search, status filters, clear completed. `test/constants.test.js` covers
the date and sorting helpers.

### Manual end-to-end checklist

1. Start the backend (`npm run dev` or `npm run dev:memory`).
2. Start the frontend (`npm run dev`) and open <http://localhost:5173>.
3. Confirm the header badge reads **API connected**.
4. Add a task -> it appears in the list and the counts increase.
5. Tick the checkbox -> it strikes through; refresh the page and it stays ticked.
6. Edit the task -> the change survives a refresh.
7. Search for part of the title -> only matching tasks show.
8. Switch filters, change sort order, clear the search.
9. Delete a task -> it disappears and stays gone after a refresh.
10. Stop the backend and click something -> a clear error appears and the checkbox
    rolls back. Restart the backend and press *Try again*.

---

## 7. Challenges faced during integration

**CORS blocking every request.** The React dev server (5173) and the API (5000)
are different origins, so the browser blocked the calls. *Fix:* configure the Vite
dev proxy so requests go through the dev server (no CORS in development), and keep
an explicit `CORS_ORIGIN` allow-list on the backend for the deployed Netlify URL.

**Unhelpful Axios errors.** Raw failures gave `Request failed with status code
500` with no context. *Fix:* one response interceptor that turns every failure into
a friendly message and carries the backend's per-field details through to the toast.

**Search firing a request per keystroke.** Typing caused a burst of requests and
out-of-order responses. *Fix:* a 350 ms debounce plus a request-id guard so only
the newest response is applied.

**Race conditions on the checkbox.** Rapid clicking sent overlapping PATCH
requests and the UI could end up disagreeing with the server. *Fix:* optimistic
updates with rollback, a `busyIds` set that disables the control mid-request, and
a refetch of the stats after each change.

**Keeping the list and the counters in sync.** Deriving the counts from the
displayed list broke as soon as a filter was applied. *Fix:* the summary comes
from `GET /api/tasks/stats` and is refreshed after every mutation, so it always
reflects the whole collection.

**Duplicated `useState`/`useEffect` logic.** The first version repeated fetching
logic in several components. *Fix:* move all task data into the `useTasks` hook and
keep the components presentational.

**Dates shifting a day.** `<input type="date">` yields `YYYY-MM-DD`, which
JavaScript parses as UTC midnight and can render as the previous day. *Fix:* the
form converts to an explicit ISO timestamp and the backend stores a real `Date`.

**Environment variables differing between dev and production.** An absolute API URL
breaks behind the dev proxy, while a relative one needs a full URL on Netlify.
*Fix:* `VITE_API_URL` defaults to `/api` for development, and the deployment guide
sets the full Render URL on Netlify.

**Optimistic updates hiding real failures.** The optimistic toggle looked great
until a request failed and the UI silently lied. *Fix:* every optimistic path keeps
the previous state and restores it on error, then shows a toast.

---

## 8. Folder map

```
frontend/
├── public/
│   └── _redirects          Netlify SPA fallback
├── src/
│   ├── api/
│   │   ├── client.js       axios instance + error interceptor
│   │   └── taskApi.js      one function per endpoint
│   ├── components/
│   │   ├── Feedback.jsx    Toast, LoadingState, ErrorState, ConnectionBadge
│   │   ├── TaskForm.jsx
│   │   ├── TaskItem.jsx
│   │   ├── TaskList.jsx
│   │   ├── TaskStats.jsx
│   │   └── TaskToolbar.jsx
│   ├── hooks/
│   │   ├── useApiHealth.js
│   │   ├── useStats.js
│   │   └── useTasks.js     all task state + actions
│   ├── styles/index.css
│   ├── App.jsx             composition root
│   ├── constants.js        options + date helpers
│   └── main.jsx
├── test/
│   ├── App.test.jsx
│   ├── constants.test.js
│   └── setup.js
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```
