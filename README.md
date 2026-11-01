# Text-to-Course

Turn text into a structured course with AI. Two independent npm packages: `client/` (Vite + React) and `server/` (Express + MongoDB).

## Auth0 setup (already done for this project)

- **Single Page Application** `Text-to-Learn Web`: Callback, Logout and Web Origin URLs = `http://localhost:5173`; Refresh Token Rotation on. This is the only Auth0 app the project uses.
- **API** `Text-to-Learn API`: its Identifier is the audience; RS256; Allow Offline Access on.
- **Connections** enabled for the SPA: `Username-Password-Authentication` and `google-oauth2` (Auth0 development keys for now).
- The auto-created Machine-to-Machine app (`Text-to-Learn API (Test Application)`) is not used.

Login, sign-up and Google all go through Auth0 Universal Login; there are no custom auth forms in the app.

## MongoDB Atlas setup (already done for this project)

An Atlas cluster with database `text-to-learn`. The `mongodb+srv://` connection string goes in `server/.env` as `MONGODB_URI`.

## Environment variables

Copy each `.env.example` to `.env` and fill in the values. `.env` files are git-ignored.

| File | Variable | Holds |
| --- | --- | --- |
| `client/.env` | `VITE_AUTH0_DOMAIN` | Tenant domain, without `https://` |
| `client/.env` | `VITE_AUTH0_CLIENT_ID` | Client ID of `Text-to-Learn Web` |
| `client/.env` | `VITE_AUTH0_AUDIENCE` | API Identifier |
| `client/.env` | `VITE_API_BASE_URL` | `/api` (proxied to the backend in dev) |
| `server/.env` | `PORT` | `5000` |
| `server/.env` | `MONGODB_URI` | Atlas connection string |
| `server/.env` | `AUTH0_ISSUER_BASE_URL` | `https://` + tenant domain + trailing `/` |
| `server/.env` | `AUTH0_AUDIENCE` | API Identifier (same as `VITE_AUTH0_AUDIENCE`) |
| `server/.env` | `CLIENT_ORIGIN` | `http://localhost:5173` (CORS) |
| `server/.env` | `GEMINI_API_KEY` | Google AI Studio API key (course generation) |
| `server/.env` | `GEMINI_MODEL` | Gemini model name, e.g. `gemini-3.5-flash-lite` |
| `server/.env` | `GEMINI_FALLBACK_MODEL` | Optional. Second model tried when the first is busy or slow, e.g. `gemini-3.5-flash` |

The server refuses to start, with a clear message, if any of its variables is missing.

## Running locally

```bash
# terminal 1: API on http://localhost:5000
cd server
npm install
npm run dev

# terminal 2: web app on http://localhost:5173
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:5000`.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Liveness check |
| POST | `/api/users/sync` | Bearer JWT | Find-or-create the user by Auth0 `sub`, refresh profile and `lastLoginAt` |
| GET | `/api/users/me` | Bearer JWT | Return the stored user (404 if never synced) |
| GET | `/api/courses` | Bearer JWT | The caller's courses (newest activity first) with progress counts and totals |
| POST | `/api/courses` | Bearer JWT | Generate a course outline with Gemini and save it (`topic`, `depth`, `sideQuest`, `hinglishAudio`). 409 if one is already generating, 502/504 on AI failure or timeout |
| GET | `/api/courses/:courseId/outline` | Bearer JWT | Modules and lessons (no lesson content) with completed flags |
| DELETE | `/api/courses/:courseId` | Bearer JWT | Delete the course, its modules and its lessons (204) |
| PATCH | `/api/courses/:courseId/progress` | Bearer JWT | Mark a lesson completed or not, and/or make it the current lesson |

A course that doesn't exist or belongs to someone else is a `404` on every `:courseId` route.

Every error response is `{ "message": string }`.

## Tests

```bash
cd server
npm test        # Vitest + supertest; Gemini is mocked and Mongo runs in memory
```

The first run downloads a `mongod` binary for `mongodb-memory-server`.
