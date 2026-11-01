# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Early scaffolding. `server/` has dependencies installed and empty layer folders but no source files yet (no `index.js`, no real scripts). `client/` has the marketing landing page integrated (`src/pages/LandingPage.jsx`, routed at `/` in `src/App.jsx`); the navbar has only "Demo" (opens the Warm Cream Demo Video modal, `src/components/LandingModals.jsx`) and "How it works" (links to the static `public/project_working.html`). The hero "Get started for free" calls `handleGetStarted`, which currently just navigates to the `/dashboard` placeholder (`src/pages/DashboardPage.jsx`, unprotected); Auth0 Universal Login will replace that body next session, and there are no custom login/sign-up forms. No backend is wired. Nothing else is built yet. `landing_page/` at the repo root is the original standalone AI Studio export it came from, kept for reference and not part of the app. Update this file as the real entry points and conventions land.

## Layout

Two independent npm packages (no root `package.json`, no workspaces). Run npm commands from inside each folder.

- `server/` — Express 5 + Mongoose API, ES modules (`"type": "module"`, so use `import`/`export` and include file extensions in relative imports).
  - Layered folders: `routes/` → `controllers/` → `services/` → `models/`, plus `middlewares/`, `utils/`, `config/`.
  - Auth: `express-oauth2-jwt-bearer` (Auth0-style JWT validation, needs audience and issuer base URL env vars).
  - LLM: `@google/genai` (Gemini) is the course-generation provider. `axios` is for outbound HTTP.
  - Config via `dotenv`. No `.env.example` exists yet.
- `client/` — Vite 8 + React 19, JavaScript (JSX, no TypeScript).
  - Landing page styling uses **Tailwind CSS v4** (`@tailwindcss/vite` plugin in `vite.config.js`, `@import "tailwindcss"` in `src/index.css`). The rest of the app is intended to use Chakra; the two are not yet wired together (no `ChakraProvider` mounted).
  - UI: **Chakra UI v3** (not v2). Use `ChakraProvider value={defaultSystem}`; v2 snippets (`theme` prop, `Modal`, `useToast`) don't apply. `@emotion/styled` and `framer-motion` are installed but not required by v3.
  - Routing: `react-router-dom` v7. Auth: `@auth0/auth0-react`.
  - `html2canvas` + `jspdf` are for exporting generated course content to PDF in the browser.
  - `vite.config.js` has no dev proxy yet, so API calls to the server need one (or an absolute base URL plus CORS).

## Commands

Client (`cd client`):
- `npm run dev` — Vite dev server
- `npm run build` / `npm run preview`
- `npm run lint` — oxlint (not ESLint)

Server (`cd server`):
- Only a placeholder `test` script exists. Vitest and supertest are installed, so the intended runner is `npx vitest` (single file: `npx vitest run path/to/file.test.js`; single test: add `-t "name"`).
- `nodemon` is installed but unused. It pulls in a `minimatch` advisory (dev-only, moderate). Do **not** run `npm audit fix --force`: it downgrades nodemon to 1.0.2. Prefer `node --watch index.js` for a dev script.
