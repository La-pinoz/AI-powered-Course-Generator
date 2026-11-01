# SPEC: Auth0 Authentication & Protected Dashboard (React + Vite + Express)

Nov 1, 2026 · @AI User

## 1. Objective & Bounded Scope

This session makes `"Get started for free →"` real: it sends the user to Auth0's hosted Universal Login (sign up, log in, or Google), brings them back to a protected `/dashboard`, and saves them in MongoDB through the Express backend.

Builds on SPEC v2 (Landing Page Navigation Cleanup), which already removed the custom Login/Sign Up modals and created the `/dashboard` placeholder and the `handleGetStarted` function.

### In scope

- Use the Auth0 tenant and MongoDB Atlas cluster already set up (Section 2). No dashboard work in this session.
- Frontend: `@auth0/auth0-react` provider, `handleGetStarted` wired to Auth0, protected `/dashboard` route, logout.
- Backend: Express server with JWT verification, MongoDB connection, `User` model, user sync endpoint.
- First-login and returning-login both go through one find-or-create endpoint, keyed on the Auth0 user ID (`sub`).

### Explicit Non-Goals (Do NOT Implement in This Session)

- Do **NOT** build any custom login, sign-up, or Google UI. Auth0's Universal Login page owns all of it.
- Do **NOT** customize Auth0's login page branding (colours, logo, fonts). Design comes later.
- Do **NOT** design the dashboard. It stays a minimal shell (Section 4.6).
- Do **NOT** change the navbar for logged-in users. `"Demo"` and `"How it works"` stay exactly as in SPEC v2.
- Do **NOT** implement email verification, custom forgot-password, or account linking (same email via password and Google = two separate Auth0 users for now).
- Do **NOT** add course, module, or lesson models, or any AI generation code.
- Do **NOT** set up deployment or production callback URLs. Local development (`http://localhost:5173`) only.

## 2. Environment Setup (Already Completed)

The Auth0 tenant and the MongoDB Atlas cluster are already set up, and the developer has every value below. The coding session must not repeat or ask about these steps; code only refers to the variable names.

### 2.1 What already exists in Auth0

| Item | Name | Notes |
| --- | --- | --- |
| Single Page Application | `Text-to-Learn Web` | The **only** app this project uses. Callback, Logout and Web Origin URLs = `http://localhost:5173`. Refresh Token Rotation on. |
| API | `Text-to-Learn API` | Its Identifier is the audience. RS256, Allow Offline Access on. |
| Machine-to-Machine app | `Text-to-Learn API (Test Application)` | Auto-created by Auth0 with the API. **Not used** by this project; never use its Client ID. |
| Connections | `Username-Password-Authentication`, `google-oauth2` | Both enabled for `Text-to-Learn Web`. Google uses Auth0's development keys for now. |

### 2.2 Environment variables (values already filled by the developer)

| File | Variable | Holds |
| --- | --- | --- |
| Frontend `.env` | `VITE_AUTH0_DOMAIN` | Tenant domain, **without** `https://` |
| Frontend `.env` | `VITE_AUTH0_CLIENT_ID` | Client ID of `Text-to-Learn Web` |
| Frontend `.env` | `VITE_AUTH0_AUDIENCE` | API Identifier |
| Frontend `.env` | `VITE_API_BASE_URL` | `/api` (proxied to the backend in dev) |
| Backend `.env` | `PORT` | `5000` |
| Backend `.env` | `MONGODB_URI` | MongoDB Atlas `mongodb+srv://` connection string, database name `text-to-learn` |
| Backend `.env` | `AUTH0_ISSUER_BASE_URL` | `https://` + tenant domain + trailing `/` |
| Backend `.env` | `AUTH0_AUDIENCE` | API Identifier, identical to `VITE_AUTH0_AUDIENCE` |
| Backend `.env` | `CLIENT_ORIGIN` | `http://localhost:5173` (CORS) |

### 2.3 Rules for the coding session

- Read every value from `import.meta.env` (frontend) or `process.env` (backend). Never hardcode a domain, Client ID, audience, or connection string.
- Do **not** create, edit, or overwrite either `.env` file. Create `.env.example` files with the variable names above and placeholder values.
- Confirm `.env` is listed in `.gitignore` for both frontend and backend.

## 3. End-to-End Flow

&#91;embedded content: login flow · 4 parties, 8 steps\]

Steps 1–4 are handled entirely by the Auth0 SDK and Universal Login; steps 5–8 are the code this session writes (Sections 4.6 and 5.4). Sign up, log in and Google all follow the same eight steps.

## 4. Frontend Requirements (React + Vite)

### 4.1 Package

- Install `@auth0/auth0-react`. No other auth library.

### 4.2 Auth0 provider (`src/context/Auth0ProviderWithNavigate.jsx`)

- Wrap the app in `Auth0Provider`, placed **inside** `BrowserRouter` so it can call `useNavigate`.
- Configuration:

  ```javascript
  <Auth0Provider
    domain={import.meta.env.VITE_AUTH0_DOMAIN}
    clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
    authorizationParams={{
      redirect_uri: window.location.origin,
      audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      scope: 'openid profile email offline_access',
    }}
    useRefreshTokens={true}
    cacheLocation="localstorage"
    onRedirectCallback={(appState) => navigate(appState?.returnTo || '/dashboard', { replace: true })}
  >
  ```
- `useRefreshTokens` + `cacheLocation="localstorage"` are required: without them, Safari and Brave log the user out on every page refresh.

### 4.3 `"Get started for free →"` (replace the body of `handleGetStarted`)

```javascript
const { isAuthenticated, loginWithRedirect } = useAuth0();
const handleGetStarted = () => {
  if (isAuthenticated) return navigate('/dashboard');
  loginWithRedirect({ appState: { returnTo: '/dashboard' } });
};
```

- Opens Auth0 on the **login** screen. Auth0's page has its own "Sign up" link, so one button covers both.
- An already-logged-in user skips Auth0 and goes straight to `/dashboard`.
- While `isLoading` is true (first split second on page load), the button stays clickable but must not throw.

### 4.4 Protected route (`src/components/ProtectedRoute.jsx`)

- Wrap the `/dashboard` element with `withAuthenticationRequired(Component, { onRedirecting: () => <LoadingSpinner /> })`.
- A logged-out visitor opening `/dashboard` directly is sent to Auth0, then returned to `/dashboard` after logging in.
- Create minimal `src/components/LoadingSpinner.jsx` and `src/components/ErrorMessage.jsx` (plain, unstyled beyond basics; reused in later milestones).

### 4.5 API helper (`src/utils/api.js`)

- One `apiRequest(path, { method, body, token })` function that prefixes `VITE_API_BASE_URL`, sets `Content-Type: application/json` and `Authorization: Bearer <token>`, parses JSON, and throws an `Error` with the server's `message` on non-2xx responses.
- Vite dev proxy in `vite.config.js`: `server.proxy['/api'] = 'http://localhost:5000'`, so the frontend calls `/api/...` with no CORS issues in development.

### 4.6 Dashboard shell (`src/pages/Dashboard.jsx`)

- On mount: `getAccessTokenSilently()` → `POST /api/users/sync` via `apiRequest`. Guard with a `useRef` so React StrictMode does not call it twice.
- While syncing: `<LoadingSpinner />`. On failure: `<ErrorMessage />` with the error text and a "Try again" button that repeats the sync.
- On success, render only:
  - `Welcome, {user.name}` using the `name` returned by the sync endpoint
  - a `Log out` button calling `logout({ logoutParams: { returnTo: window.location.origin } })`
  - two empty placeholder sections labelled `Create a curriculum` and `Your past courses` (text only, no functionality)

### 4.7 Auth0 callback errors

- If `useAuth0().error` is set (e.g. the user cancels Google consent), the landing page shows `<ErrorMessage />` with `error.message` above the hero CTA. The rest of the landing page is unchanged.

## 5. Backend Requirements (Node.js + Express + MongoDB)

### 5.1 Packages & folder structure

- Packages: `express`, `mongoose`, `express-oauth2-jwt-bearer`, `cors`, `dotenv`; dev: `nodemon`.
- Follow the roadmap's Milestone 2 structure:

```text
server/
├── server.js                      // Application entry point: loads env, connects DB, mounts routes, starts on PORT
├── routes/                        // Defines API endpoints
│   ├── healthRoutes.js            // GET /api/health
│   └── userRoutes.js              // POST /api/users/sync, GET /api/users/me (both behind checkJwt)
├── controllers/                   // Business logic for routes
│   └── userController.js          // syncUser, getMe
├── middlewares/                   // Authentication, error handling, validation
│   ├── checkJwt.js                // auth({ audience, issuerBaseURL }) from express-oauth2-jwt-bearer
│   └── errorHandler.js            // one { message } JSON error shape for every failure
├── models/                        // Mongoose schemas
│   └── User.js
├── services/                      // External logic (Auth0 now, AI integrations later)
│   └── auth0Service.js            // fetchUserInfo(accessToken) → GET {issuer}/userinfo
├── utils/                         // Utility functions
│   └── asyncHandler.js            // wraps async controllers so errors reach errorHandler
└── config/                        // Database connection and environment setup
    ├── env.js                     // loads dotenv, checks required vars (Section 2.2), exits with a clear message if any is missing
    └── db.js                      // mongoose.connect(MONGODB_URI), logs success, exits on failure
```

### 5.2 `User` model (`models/User.js`)

```javascript
const userSchema = new mongoose.Schema({
  auth0Id:     { type: String, required: true, unique: true, index: true }, // Auth0 `sub`, e.g. 'auth0|abc' or 'google-oauth2|123'
  email:       { type: String, lowercase: true, trim: true },
  name:        { type: String, trim: true },
  picture:     String,
  lastLoginAt: Date
}, { timestamps: true });
```

- `auth0Id` is the only unique key. `email` is **not** unique: the same email via password and via Google produces two different `sub` values (account linking is a non-goal).
- Later milestones' `Course.creator` will store this `auth0Id`, matching the roadmap's schema.

### 5.3 Endpoints

| Method | Path | Auth | Behaviour | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | none | Liveness check | `200 { status: "ok" }` |
| POST | `/api/users/sync` | `checkJwt` | Find-or-create the user (5.4) | `200 { user }` |
| GET | `/api/users/me` | `checkJwt` | Return the stored user for `req.auth.payload.sub` | `200 { user }`, or `404` if never synced |

### 5.4 `POST /api/users/sync` logic

1. `checkJwt` verifies the Bearer token (signature, issuer, audience, expiry). Invalid or missing → `401`.
2. Read `sub` from `req.auth.payload.sub`.
3. Call `fetchUserInfo(token)` to get `email`, `name`, `picture` from Auth0. Profile fields are taken from Auth0, never from the request body.
4. `User.findOneAndUpdate({ auth0Id: sub }, { $set: { email, name, picture, lastLoginAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true })`. One atomic call handles both first login and returning login.
5. Respond `200 { user }` with `_id`, `auth0Id`, `email`, `name`, `picture`, `createdAt`, `lastLoginAt`.

- If `/userinfo` fails (Auth0 rate limit or network), fall back to updating only `lastLoginAt` for an existing user; for a brand-new user return `502 { message: "Could not load your profile from Auth0. Please try again." }`.

### 5.5 Error shape, CORS, startup

- Every error response is `{ message: string }` with the right status (`401`, `404`, `500`, `502`). `errorHandler` maps `express-oauth2-jwt-bearer` errors to `401 { message: "Please log in again." }`. No stack traces in responses.
- `cors({ origin: CLIENT_ORIGIN })`; `express.json()` body parsing.
- The server refuses to start, with a clear log line, if any required env var from Section 2.2 is missing.

## 6. Acceptance Criteria & Verification Checklist

### Sign up & log in

- [ ] Logged out, clicking `"Get started for free →"` leaves the site for the Auth0 Universal Login page.
- [ ] Signing up there with a new email + password lands the user on `/dashboard` showing `Welcome, {name}`.
- [ ] Signing up with an email that already exists shows Auth0's own "user already exists" error; no custom code handles this.
- [ ] "Continue with Google" on the Auth0 page signs the user in and lands on `/dashboard`.
- [ ] Logging in again with an existing account lands on `/dashboard` and does **not** create a second `User` document.

### Session & protection

- [ ] Refreshing `/dashboard` keeps the user logged in (tested in Chrome and, if available, Safari or Brave).
- [ ] Opening `/dashboard` while logged out redirects to Auth0, then back to `/dashboard` after login.
- [ ] Logged in, clicking `"Get started for free →"` on the landing page goes straight to `/dashboard` without visiting Auth0.
- [ ] `Log out` on the dashboard returns the user to the landing page; opening `/dashboard` afterwards asks them to log in again.

### Backend & database

- [ ] `GET /api/health` returns `200 { status: "ok" }`.
- [ ] `POST /api/users/sync` with no token or a bad token returns `401 { message }`.
- [ ] After a first login, MongoDB holds one `users` document with `auth0Id`, `email`, `name`, `picture`, `createdAt`, `lastLoginAt`.
- [ ] After a second login, the same document's `lastLoginAt` is newer and no new document exists.
- [ ] Signing in with Google using the same email as a password account creates a separate document (expected; linking is a non-goal).

### Code & housekeeping

- [ ] No custom login/sign-up form, modal, or Google button exists anywhere in the frontend.
- [ ] `.env` files are git-ignored; `.env.example` files exist for frontend and backend.
- [ ] README summarises the Auth0 and MongoDB Atlas setup from Section 2 and how to run frontend and backend locally.
- [ ] `npm run build` (frontend) succeeds with zero errors; `npm run dev` (backend) starts and logs a successful MongoDB connection.
