# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules

- **Never write or edit code unless the user explicitly asks for it.** Bash commands the user runs themselves (`git switch`, `git pull`, `git status`, creating a branch, etc.) are just them running commands, not requests for work. Do not infer a task from a branch name, session name, or earlier discussion. Acknowledge the output briefly, then wait for an explicit instruction. If the next step seems obvious, offer it in one line and let the user decide.

## Status

Early stage; Auth0 login and user sync (spec `.claude/specs/2_auth0-implementation.md`) and the dashboard with course-outline generation (spec `.claude/specs/3_dashboard-ui.md`) are implemented. `client/` has the marketing landing page (`src/pages/LandingPage.jsx`, routed at `/` in `src/App.jsx`); the navbar has only "Demo" (opens the Warm Cream Demo Video modal, `src/components/LandingModals.jsx`) and "How it works" (links to the static `public/project_working.html`). The hero "Get started for free" calls `handleGetStarted`, which runs `loginWithRedirect` (or goes straight to `/dashboard` if already signed in); Auth0 callback errors show on the landing page. There are no custom login/sign-up forms; Auth0 Universal Login owns all of it.

The dashboard: `/dashboard`, `/courses/:courseId` and `/courses/:courseId/lessons/:lessonId` are children of one protected layout route (`src/layouts/DashboardLayout.jsx`, wrapped in `ProtectedRoute`). The layout calls `POST /api/users/sync` once, then mounts Chakra (dark-only) with a course-tree sidebar (a drawer below 768px), a top bar with the user menu, and the page. `pages/Dashboard.jsx` is just the Create Course form and Continue Learning cards; `pages/CoursePlaceholder.jsx` is a stand-in for the course/lesson pages, which are not built yet. State lives in `src/context/CoursesContext.jsx` (courses, lazily fetched outlines, tree expansion; read it with `hooks/useCourses.js`). Components are in `src/components/dashboard/`.

`server/` has the Express API: `GET /api/health`, `POST /api/users/sync`, `GET /api/users/me`, and the course routes under `/api/courses` (list, outline, create/generate, delete, progress `PATCH`). Models: `User` (keyed on Auth0 `sub`), `Course` (owns `creator`, options and embedded lesson progress), `Module`, `Lesson`. Course creation calls Gemini for the outline only. Not built yet: lesson content, Side Quest and Hinglish audio generation (the two toggles are stored on the course and passed to the prompt as context), the real course/lesson pages. `landing_page/` at the repo root is the original standalone AI Studio export the landing page came from, kept for reference and not part of the app. Update this file as the real entry points and conventions land.

## Layout

Two independent npm packages (no root `package.json`, no workspaces). Run npm commands from inside each folder.

- `server/` — Express 5 + Mongoose API, ES modules (`"type": "module"`, so use `import`/`export` and include file extensions in relative imports).
  - Layered folders: `routes/` → `controllers/` → `services/` → `models/`, plus `middlewares/`, `utils/`, `config/`.
  - Auth: `express-oauth2-jwt-bearer` (Auth0-style JWT validation, needs audience and issuer base URL env vars).
  - LLM: `@google/genai` (Gemini) is the course-generation provider. `axios` is for outbound HTTP.
  - Config via `dotenv`: `config/env.js` loads `.env`, checks the seven required vars (`PORT`, `MONGODB_URI`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_AUDIENCE`, `CLIENT_ORIGIN`, `GEMINI_API_KEY`, `GEMINI_MODEL`) and exits if any is missing. `.env.example` exists; never edit `.env`.
  - Every error response is `{ message }`, produced by `middlewares/errorHandler.js` (it shows the message for statuses below 500 and for 502/504; other 5xx are generic). `app.js` builds the Express app (importable by tests); `server.js` connects to Mongo and listens.
  - Every course query is filtered by `creator` (the Auth0 `sub`); a course that isn't the caller's is a 404, never a 403. Constants shared with the client live in `utils/courseConstants.js` and must stay identical to `client/src/constants/course.js`.
  - Generation (`services/courseGenerationService.js`): one Gemini call with a JSON schema, 90s timeout (504), anything else that fails or doesn't validate is a 502. A per-user in-memory lock (in `services/courseService.js`) returns 409 for a second concurrent generation; it only works for a single server process.
- `client/` — Vite 8 + React 19, JavaScript (JSX, no TypeScript).
  - Landing page styling uses **Tailwind CSS v4** (`@tailwindcss/vite` plugin in `vite.config.js`, `@import "tailwindcss"` in `src/index.css`). The landing page must not change when the dashboard is visited.
  - Dashboard UI: **Chakra UI v3** (not v2; v2 snippets like the `theme` prop, `Modal` and `useToast` don't apply). The system is in `src/theme/system.js` (`preflight: false`, and it neutralises Chakra's default `html` colors). The dashboard palette is defined once, as Tailwind theme values in `@theme static` in `src/index.css` (`--color-app-*`, matching the landing page's warm dark look with an orange accent, olive progress and brick-red brand); `system.js` maps Chakra tokens to those variables with `var(...)`, so don't hard-code hex in dashboard components. `colorPalette="accent"` is a custom Chakra palette built from the accent variable. Headings use the landing page's `--font-heading` with `letterSpacing="tight"`; the sidebar shows the landing page's "AI-Powered Course Generator ✳" wordmark; primary actions use `components/dashboard/PillButton.jsx` (white pill, brand-colored text, → arrow). `ChakraProvider` is mounted only inside `DashboardLayout`, not in `main.jsx`, and the layout puts `.dark` on `<html>` while mounted so portaled menus, dialogs and the drawer are dark too. Toasts use `components/dashboard/toaster.js` + `AppToaster.jsx`. No icon package; icons are inline SVGs in `components/dashboard/icons.jsx`.
  - Chakra gotchas found here: `Field.Root` ignores `ids`, so set `id` instead; the `RadioCard` border and checked state are on `Item`, not `ItemControl`; the `progressbar` role is on `Progress.Track`, so give the label there; `SkipNavLink` takes `id` (its target), not `href`; Menu `onSelect` goes on `Menu.Root` and receives `{ value }`.
  - Routing: `react-router-dom` v7. Auth: `@auth0/auth0-react`, provider in `src/context/Auth0ProviderWithNavigate.jsx` (inside `BrowserRouter`). API calls go through `src/utils/api.js` (`apiRequest`).
  - `html2canvas` + `jspdf` are for exporting generated course content to PDF in the browser.
  - `vite.config.js` proxies `/api` to `http://localhost:5000` in dev.

## Commands

Client (`cd client`):
- `npm run dev` — Vite dev server
- `npm run build` / `npm run preview`
- `npm run lint` — oxlint (not ESLint)

Server (`cd server`):
- `npm run dev` — `node --watch server.js`; `npm run start` — `node server.js`.
- `npm test` runs Vitest (`vitest.config.js` sets dummy env vars). Tests are in `server/tests/`: supertest against `app.js`, `checkJwt` and the Gemini service mocked, Mongo via `mongodb-memory-server` (the first run downloads a `mongod` binary). Single file: `npx vitest run tests/courses.test.js`; single test: add `-t "name"`.
- `nodemon` was removed (it pulled in a `minimatch` advisory); use `node --watch`.
