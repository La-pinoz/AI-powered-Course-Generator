# Spec 11 — Deployment: Render (API) and Vercel (Web App)

Nov 26, 2026

Branch 3 of 4 (suggested name `deploy/render-vercel`). Needs Spec 10 (CI) merged first. Spec 12 (README and docs) comes after.

Roadmap Milestone 12, "Hosting and Deployment": *"Deploy the backend on Render and the frontend on Vercel, integrating them for seamless operation"*, plus the "automated deployment" half of its CI/CD section. Also the problem statement's deliverable: *"a live, publicly accessible site URL"*.

Most of this spec is configuration in the Render, Vercel, Auth0 and MongoDB Atlas dashboards. The code changes are small: a Vercel routing config, and `CLIENT_ORIGIN` accepting more than one origin.

## Problem Statement

The app only runs on `localhost`, so there is no live URL to submit, and judges can't try it. Moving it online hits a few things that work locally but not in production:

- The client is a single-page app. On a static host, refreshing `/dashboard` or a lesson page asks the host for a file that doesn't exist, and the user gets a 404.
- In development, the Vite proxy forwards `/api` to the server. In production there is no proxy, so the client has to call the API at its own address.
- The API allows exactly one browser origin (`CLIENT_ORIGIN`), so it can't allow both the live site and `localhost` at the same time.
- Auth0 only allows `http://localhost:5173` as a callback, logout and web origin, so signing in on the live site would fail.
- MongoDB Atlas only accepts connections from allowed IP addresses, and Render's free tier has no fixed IP.
- The server keeps its lesson queue, audio and video jobs, daily limits and the generation lock in memory. That breaks if the host runs more than one copy, and the free tier sleeps when idle.

## Solution

- The API runs on **Render** as one web service, built from the `server` folder, with `/api/health` as its health check. It deploys `main` automatically once CI has passed.
- The web app runs on **Vercel**, built from the `client` folder.
  - A routing rule sends every path that isn't a real file to the app, so every page survives a refresh.
  - `main` deploys to production, and every pull request gets a preview build.
- The client calls the API at the Render address through `VITE_API_BASE_URL`, which `apiRequest` already supports.
- `CLIENT_ORIGIN` accepts a comma-separated list, so the API allows both the live site and `localhost`.
- Auth0 allows the live site's address for sign-in, sign-out and token requests.
- Atlas accepts connections from Render.
- The API is fixed at one instance. A cold start after idle shows as slow loading, not an error. Lessons interrupted by a sleep resume, as they already do after a restart.

## User Stories

1. As a judge, I want a public URL that opens the landing page, so that I can try the app without installing anything.
2. As a judge, I want "Get started for free" to sign me in through Auth0 on the live site and land me on the dashboard, so that the login flow works in production as it does locally.
3. As a judge, I want to sign up with email or Google on the live site, so that I can use my own account.
4. As a judge, I want "Log out" on the live site to bring me back to the live landing page, not to `localhost`, so that signing out works.
5. As a judge, I want to refresh any page (dashboard, course, lesson, module video) on the live site without a 404, so that the app behaves like a normal website.
6. As a judge, I want to open a link to a lesson in a new tab and land on that lesson after signing in, so that deep links work.
7. As a judge, I want the "How it works" page to keep opening, so that the static explainer page isn't swallowed by the app's routing.
8. As a judge, I want to generate a course on the live site and watch its lessons get written, so that I can see the core feature working end to end.
9. As a judge, I want the quiz, Hinglish audio, module video and PDF download to work on the live site, so that every feature shown in the demo works for me too.
10. As a judge opening the app after it has been idle, I want the first request to wait for the API to wake up rather than fail, so that a cold start looks like slow loading, not an error.
11. As a learner whose lesson was being written when the server went to sleep, I want that lesson to be picked up again when I come back, so that it doesn't stay stuck on "Preparing".
12. As the project owner, I want the live API's health check to report healthy, so that Render only sends traffic to a running server.
13. As the project owner, I want the server to refuse to start with a clear message when a production variable is missing, as it does locally, so that a misconfigured deploy fails loudly in Render's logs.
14. As the project owner, I want the API to accept browser requests only from the live web app and from `localhost` when I configure it, so that other sites can't call it from a user's browser.
15. As the project owner, I want `CLIENT_ORIGIN` to stay a single value when that's all I need, so that my local `.env` keeps working unchanged.
16. As the project owner, I want the API to run as exactly one instance, so that the in-memory lesson queue, audio and video jobs, daily limits and generation lock stay correct.
17. As the project owner, I want the Gemini, YouTube and database secrets to exist only in Render's environment, never in a `VITE_` variable, so that they never reach the browser bundle.
18. As the project owner, I want Render to deploy `main` only after CI has passed, so that a broken commit never reaches the live API.
19. As the project owner, I want Vercel to deploy `main` to production automatically after a merge, so that releasing is just merging a pull request.
20. As the project owner, I want Vercel to build a preview for every pull request, so that I can look at UI changes before merging.
21. As the project owner, I want to roll back to the previous deploy from each host's dashboard, so that I can undo a bad release in a minute.
22. As the project owner, I want the database to accept connections from Render without exposing it more than necessary, so that the data stays safe with a host that has no fixed IP.
23. As the project owner, I want the live URLs and the Render/Vercel/Auth0/Atlas settings written down (in the README, Spec 12), so that I can rebuild the deployment from scratch.

## Implementation Decisions

### Code changes in this branch

- **Vercel routing config** in the `client` folder: one rewrite that sends every request not matching a built file to `index.html`. Built files, including the static `project_working.html` and the assets, are served as themselves. Nothing else is configured there; headers and caching stay Vercel's defaults.
- **`CLIENT_ORIGIN` list:**
  - The env loader reads `CLIENT_ORIGIN` as a comma-separated list. It splits on commas, trims each entry, drops empty ones and requires at least one.
  - A single value keeps working exactly as today, so existing `.env` files need no change.
  - The parsing is a small pure helper next to the env loader, so it can be tested without starting the server.
  - The app passes the resulting array to the `cors` middleware. Origins are compared exactly; there are no wildcards or patterns.
- `.env.example` (server) describes the list format with an example.
- **No change to `apiRequest`:** it already uses `VITE_API_BASE_URL`, falling back to `/api` for local development with the Vite proxy.
- **No change to the server's start-up:** `server.js` already reads `PORT` (Render sets it), connects to Mongo, runs the stale-lesson and audio recovery, and listens. `GET /api/health` already exists and needs no auth.
- CLAUDE.md is updated: the `CLIENT_ORIGIN` list format and the deployment targets (Render for `server`, Vercel for `client`, one API instance).

### Render (API)

- **New Web Service** from the GitHub repository, with root directory `server`.
- Build command `npm ci`; start command `npm start`. The Node version comes from the `engines` field pinned in Spec 10.
- Health check path `/api/health`.
- **Exactly one instance**, no autoscaling, because the queue, jobs, daily limits and the 409 lock live in memory.
- **Auto-deploy** on `main`, set to deploy only after CI checks pass.
- **Environment:** every server variable from `.env.example` is set in Render's dashboard.
  - Required: `MONGODB_URI`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_AUDIENCE`, `CLIENT_ORIGIN`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
  - `PORT` is set by Render, so it is not added by hand.
  - `CLIENT_ORIGIN` holds the production Vercel origin (optionally followed by `http://localhost:5173`).
  - Optional ones as wanted: the Gemini fallback model, the lesson, audio and video settings, `YOUTUBE_API_KEY` and `YOUTUBE_REGION_CODE`.
  - Secrets are typed into the dashboard. They are never committed, and never put in a `render.yaml`.

### Vercel (web app)

- **New Project** from the same repository, with root directory `client`, the Vite framework preset, build `npm run build` and output `dist`.
- **Environment variables** (Production and Preview): `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, and `VITE_API_BASE_URL` set to the full Render URL ending in `/api`.
- There is **no** `VITE_YOUTUBE_API_KEY`. The roadmap suggests one, but it is deliberately left out: every `VITE_` value is compiled into the public bundle, and the YouTube key is only ever used by the server.
- `main` deploys to production; every pull request gets a preview build.
- Preview builds are for looking at the UI only. Their addresses are not in `CLIENT_ORIGIN` or Auth0, so signing in and API calls on a preview are not expected to work.

### Auth0

- In the `Text-to-Learn Web` single-page application, the production Vercel origin is added next to `http://localhost:5173` in Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins.
- The API (audience), the connections (email and password, Google) and refresh-token rotation stay as they are.
- Google sign-in still uses Auth0's development keys. That works, but Auth0 shows a warning on its login page. Setting up the project's own Google OAuth keys is optional and out of scope.

### MongoDB Atlas

- Render's free tier has no fixed outbound IP addresses, so Atlas Network Access allows `0.0.0.0/0`.
- Security then rests on the database user's credentials. That user has access only to the `text-to-learn` database, its password is long and random, and it lives only in Render's environment and the owner's local `.env`.
- The README (Spec 12) states this trade-off.

### Running on the free tier

- Render's free instance sleeps after about 15 minutes without requests and takes up to about a minute to wake. No keep-alive pinger is added.
- The client's existing loading states cover the wait, and the README warns judges.
- When it wakes, `recoverStaleLessons` runs at start-up and `ensureQueued` runs on the next outline or lesson GET, so lessons interrupted by the sleep are written again. Interrupted audio jobs become `failed` and can be retried, as after any restart.
- In-memory daily limits reset when the instance restarts. That is accepted for a hackathon deployment.

### Rollback

- Each host's dashboard can redeploy a previous successful deploy. Nothing is automated. The README (Spec 12) documents the steps.

## Testing Decisions

- **Automated (server, supertest, prior art: the existing app-level tests):**
  - The `CLIENT_ORIGIN` parser: a single value, a list with spaces, empty entries ignored, an all-empty value rejected.
  - With two allowed origins, a request from each one gets the matching `Access-Control-Allow-Origin` header, and a request from a third origin doesn't.
  - The existing health check test keeps passing.
- These run in CI (Spec 10) on this branch's pull request.
- **Manual check on the live URLs** (the README in Spec 12 keeps this as a checklist):
  1. The landing page loads, and "How it works" opens the static page.
  2. Sign up, sign in (email and Google) and log out, ending on the live site each time.
  3. Refresh on the dashboard, a course, a lesson and a module video page.
  4. Create a course. The outline appears, then lessons get written.
  5. Answer a quiz, mark a lesson completed and check the sidebar ✓.
  6. Listen in Hinglish on a lesson.
  7. Open a module video, and download a lesson PDF.
  8. Delete a course.
  9. Let the API sleep, come back and check that the first request waits and then works.
  10. In the browser's network tab, check that no request goes to `localhost` and that the bundle contains no Gemini or YouTube key.
- On the Vercel preview of this pull request, check that refreshing a deep link serves the app, not a 404. Sign-in there is not expected to work.

## Out of Scope

- Custom domains and HTTPS certificates beyond the hosts' defaults.
- Preview environments with their own API or database, and allowing preview URLs in CORS or Auth0.
- Deploying from GitHub Actions with deploy hooks, CLIs or repository secrets.
- Docker images, `render.yaml` and other infrastructure-as-code, Terraform.
- Running more than one API instance, moving the queue, jobs or limits to Redis or the database, and a keep-alive pinger.
- Paid tiers, static outbound IPs and Atlas private networking.
- The project's own Google OAuth keys in Auth0.
- Monitoring, alerting, log shipping and uptime checks.
- The README rewrite (Spec 12).

## Further Notes

- The roadmap's env names (`MONGO_URI`, `AUTH0_ISSUER`) differ from ours (`MONGODB_URI`, `AUTH0_ISSUER_BASE_URL`). Use ours in Render. The README (Spec 12) notes the mapping.
- Order inside this branch:
  1. Merge the code changes (they are harmless locally).
  2. Create the Render service and copy its URL.
  3. Create the Vercel project with that URL in `VITE_API_BASE_URL`, and copy the Vercel URL.
  4. Put the Vercel URL into Render's `CLIENT_ORIGIN` and into Auth0.
  5. Allow Render in Atlas.
  6. Run the manual checklist.
- Keep the live URLs handy for Spec 12.
