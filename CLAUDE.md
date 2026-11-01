# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules

- **Never write or edit code unless the user explicitly asks for it.** Bash commands the user runs themselves (`git switch`, `git pull`, `git status`, creating a branch, etc.) are just them running commands, not requests for work. Do not infer a task from a branch name, session name, or earlier discussion. Acknowledge the output briefly, then wait for an explicit instruction. If the next step seems obvious, offer it in one line and let the user decide.

## Status

Early stage; Auth0 login and user sync are implemented (spec: `.claude/specs/2_auth0-implementation.md`), nothing course-related yet. `client/` has the marketing landing page (`src/pages/LandingPage.jsx`, routed at `/` in `src/App.jsx`); the navbar has only "Demo" (opens the Warm Cream Demo Video modal, `src/components/LandingModals.jsx`) and "How it works" (links to the static `public/project_working.html`). The hero "Get started for free" calls `handleGetStarted`, which runs `loginWithRedirect` (or goes straight to `/dashboard` if already signed in); Auth0 callback errors show on the landing page. `/dashboard` (`src/pages/Dashboard.jsx`) is wrapped in `src/components/ProtectedRoute.jsx`, calls `POST /api/users/sync` once on mount, then shows a welcome line, a Log out button and two empty placeholder sections. There are no custom login/sign-up forms; Auth0 Universal Login owns all of it. `server/` has the Express API (`server.js`): `GET /api/health`, `POST /api/users/sync`, `GET /api/users/me`, a `User` model keyed on Auth0 `sub`. Not built yet: courses, modules, lessons, AI generation, dashboard features. `landing_page/` at the repo root is the original standalone AI Studio export it came from, kept for reference and not part of the app. Update this file as the real entry points and conventions land.

## Layout

Two independent npm packages (no root `package.json`, no workspaces). Run npm commands from inside each folder.

- `server/` — Express 5 + Mongoose API, ES modules (`"type": "module"`, so use `import`/`export` and include file extensions in relative imports).
  - Layered folders: `routes/` → `controllers/` → `services/` → `models/`, plus `middlewares/`, `utils/`, `config/`.
  - Auth: `express-oauth2-jwt-bearer` (Auth0-style JWT validation, needs audience and issuer base URL env vars).
  - LLM: `@google/genai` (Gemini) is the course-generation provider. `axios` is for outbound HTTP.
  - Config via `dotenv`: `config/env.js` loads `.env`, checks the five required vars (`PORT`, `MONGODB_URI`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_AUDIENCE`, `CLIENT_ORIGIN`) and exits if any is missing. `.env.example` exists; never edit `.env`.
  - Every error response is `{ message }`, produced by `middlewares/errorHandler.js`. Entry point is `server.js`.
- `client/` — Vite 8 + React 19, JavaScript (JSX, no TypeScript).
  - Landing page styling uses **Tailwind CSS v4** (`@tailwindcss/vite` plugin in `vite.config.js`, `@import "tailwindcss"` in `src/index.css`). The rest of the app is intended to use Chakra; the two are not yet wired together (no `ChakraProvider` mounted).
  - UI: **Chakra UI v3** (not v2). Use `ChakraProvider value={defaultSystem}`; v2 snippets (`theme` prop, `Modal`, `useToast`) don't apply. `@emotion/styled` and `framer-motion` are installed but not required by v3.
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
- Only a placeholder `test` script exists. Vitest and supertest are installed, so the intended runner is `npx vitest` (single file: `npx vitest run path/to/file.test.js`; single test: add `-t "name"`).
- `nodemon` was removed (it pulled in a `minimatch` advisory); use `node --watch`.
