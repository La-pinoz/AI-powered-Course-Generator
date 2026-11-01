# Plan (v2): Landing page cleanup — Demo modal only, Auth0-ready CTA, `/dashboard` placeholder

Spec: `.claude/specs/1_lp-button-working.md` (v2). It replaces the v1 plan (login/signup modals, `/profile`), which was already implemented in this working tree.

## Context

Auth0's hosted Universal Login will provide the login and sign-up screens next session, so the custom auth UI built last round has to go. The landing page ends up with one entry point (the hero "Get started for free →", which goes to a `/dashboard` placeholder for now), "Demo" and "How it works" moved into the two top-right navbar slots, and the Demo modal as the only modal. This session adds no Auth0 SDK usage and no backend. The hero layout, video, typography and crimson look stay untouched.

## Current state (verified in the working tree)

- `client/src/pages/LandingPage.jsx`:
  - Line 13: `activeModal` is typed `'login' | 'signup' | 'demo' | null`.
  - Lines 133-137: `handleAuthSuccess` navigates to `/profile`.
  - Lines 172-190: the desktop `<nav>` is centered and holds the "How it works" `<a>` and the "Demo" button, both of which must go.
  - Lines 192-208: the right-hand group holds "Log in" (plain text button, line 194-200) and "Sign up free" (white pill, line 201-207).
  - Lines 236-278: the mobile overlay holds How it works, Demo, Log in and Sign up free.
  - Line 304: the hero CTA calls `setActiveModal('login')`.
  - Line 314: renders `<LandingModals ... onAuthSuccess={handleAuthSuccess} />`.
- `client/src/components/LandingModals.jsx`: contains Login, Signup and Demo modals plus helpers (`GoogleIcon`, `GoogleButton`, `Field`, `Eyebrow`, `Divider`, `inputClass`, `primaryButtonClass`, `linkButtonClass`). The shell, Escape handler and scroll lock are correct and are kept.
- `client/src/pages/ProfilePage.jsx` and the `/profile` route in `client/src/App.jsx` exist, and both must be removed.
- `client/public/project_working.html` already exists and contains only "OK working". It needs no change.
- `client/src/index.css` has a `fadeInUp` keyframe that only the removed copy-email toast used. It is now dead CSS.
- `client/package.json` already lists `@auth0/auth0-react` from the original scaffold. I add nothing to `package.json` and don't remove that entry (removing it would break the next session).
- `.gitignore` is already set up and `server/node_modules` is untracked, so this change doesn't affect it.

## File-by-file changes

### 1. `client/src/components/LandingModals.jsx` — shrink to Demo only (rewrite)
- Keep `export const DEMO_YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"; // TODO: Replace with final project demo video URL` at the top, exactly as the spec words it.
- Delete: `inputClass`, `primaryButtonClass`, `linkButtonClass`, `GoogleIcon`, `GoogleButton`, `Field`, `Eyebrow`, `Divider`, `LoginModal`, `SignupModal`. None of the v1 form, eyebrow or green CTA tokens stay, per spec section 5.
- Keep the overlay and card shell, the `✕` close button, the Escape listener and the body scroll lock. The shell uses the spec's tokens:
  - Overlay: `rgba(28,10,8,0.45)` with `blur(10px)`.
  - Card: `#FAF6EE`, `1px solid #E5DEC9`, radius 20px, shadow `0 25px 50px -12px rgba(0,0,0,0.35)`.
  - `✕`: `#5C5852` with hover `#1F2421`.
- Component signature becomes `LandingModals({ activeModal, setActiveModal })` with no `onAuthSuccess`.
- Render the Demo content only when `activeModal === 'demo'`:
  - A heading that reads exactly "Demo Video" (`#1F2421`, bold, no eyebrow or subtitle).
  - A `aspect-video` container with `rounded-xl` (12px), `overflow-hidden` and `bg-black`, holding `<iframe src={DEMO_YOUTUBE_EMBED_URL} title="Demo Video" allowFullScreen className="w-full h-full border-0" />`.
- Fix the card width: with only one modal, always use `max-w-3xl` (no per-modal width branch).
- Closing sets `activeModal` to `null`, which unmounts the iframe and stops playback.
- The file name stays `LandingModals.jsx`, since the single `activeModal` state is meant to leave room for future modals.

### 2. `client/src/pages/LandingPage.jsx` — navbar, CTA, state
- Line 13: `useState(null); // 'demo' | null`.
- Replace `handleAuthSuccess` (lines 133-137) with the spec's single named handler:
  ```js
  // TODO (Auth0 session): replace with loginWithRedirect({ appState: { returnTo: '/dashboard' } })
  const handleGetStarted = () => navigate('/dashboard');
  ```
  `navigate` still comes from `useNavigate`, which is already imported.
- Delete the whole centered desktop `<nav>` (lines 172-190). The center-right area is then empty, and `justify-between` keeps the logo on the left and the right-hand group on the right.
- Right-hand group (lines 192-208), swapping content only and reusing the existing class strings character for character:
  - Old "Log in" slot becomes `Demo`: the same `<button type="button">` with the same classes (`text-[15px] text-white hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-none p-0 font-medium`) and `onClick={() => setActiveModal('demo')}`.
  - Old "Sign up free" slot becomes `How it works`: an `<a href="/project_working.html">` with the existing pill classes (`bg-white text-neutral-900 hover:bg-neutral-100 transition-colors font-semibold text-[14px] sm:text-[15px] px-5 py-2 sm:py-2.5 rounded-full cursor-pointer shadow-sm`) plus `no-underline`. It sits inside the flex container, so it is blockified and the padding behaves like the old button's.
- Mobile overlay (lines 236-278), which the spec doesn't mention, so I mirror the desktop slot mapping:
  - `Demo` becomes the plain text item in the old "Log in" slot, closing the menu and calling `setActiveModal('demo')`.
  - `How it works` becomes the pill in the old "Sign up free" slot, as `<a href="/project_working.html">` with the pill classes already used there.
  - The existing top two items and the "Log in" and "Sign up free" buttons are replaced by these two, so there are no duplicates.
- Hero CTA (line 304): `onClick={handleGetStarted}`. The button markup, text and styling are unchanged.
- Line 314: `<LandingModals activeModal={activeModal} setActiveModal={setActiveModal} />`.
- Don't touch the video effect, the hamburger button, the hero section or the logo.

### 3. `client/src/pages/ProfilePage.jsx` — delete
Use `git rm -f client/src/pages/ProfilePage.jsx`. The file was only ever staged (the repo has no commits), so this just removes it from the index and from disk.

### 4. `client/src/pages/DashboardPage.jsx` — create
A default-export component with a centered plain layout (reusing the cream background and text color from the old profile placeholder) rendering exactly `Dashboard — Auth0 Integration Pending`. No styling work beyond that, and no auth guard (the spec says to leave it unprotected).

### 5. `client/src/App.jsx` — route swap
Replace the `ProfilePage` import and route with `DashboardPage` and `<Route path="/dashboard" element={<DashboardPage />} />`, still before the `*` catch-all. After that `/profile` falls through to the catch-all and redirects to `/`.

### 6. `client/src/index.css` — remove dead CSS
Delete the `fadeInUp` keyframes block and its comment (lines 29-39), since the toast that used it is gone. I leave `blink` and `.animate-blink` alone because they predate this work.

### 7. `CLAUDE.md` — Status section
Replace the sentence about login/signup modals and `/profile` with the new state: Demo modal only (`src/components/LandingModals.jsx`), "How it works" links to `public/project_working.html`, the hero CTA goes to the `/dashboard` placeholder through `handleGetStarted`, and Auth0 plus the backend arrive next session.

### Unchanged
`client/public/project_working.html`, `client/src/main.jsx`, `client/vite.config.js`, `client/package.json` and `client/package-lock.json`.

## Decisions (tell me if you disagree)
- The mobile menu mirrors the desktop mapping (Demo as text, How it works as a pill), because the spec only describes the desktop navbar.
- I keep the file name `LandingModals.jsx` rather than renaming it to `DemoModal.jsx`.
- I remove the now-dead `fadeInUp` CSS, which the spec's "no dead CSS" intent covers.
- I leave `@auth0/auth0-react` in `package.json` because it was already there from the scaffold. The acceptance item "no Auth0 packages were added" holds because I add nothing.

## Verification
1. `cd client && npm run build` must pass with zero errors, and `npm run lint` should show nothing new.
2. `git diff -- client/package.json client/package-lock.json` must be empty (no package changes).
3. Grep `client/src` for `Pitch us`, `Mainframe`, `Welcome back`, `Create your free account`, `Sign up`, `Log in`, `Google`, `login`, `signup`, `profile` and `Profile`. There should be no matches, apart from the TODO comment mentioning `loginWithRedirect`.
4. In `npm run dev`, step through the acceptance checklist:
   - The navbar shows no "Log in" or "Sign up free", and nothing sits in the center.
   - "Demo" appears as a white text link in the old Log-in position, and "How it works" appears as the white pill in the old Sign-up position, with no duplicates elsewhere.
   - Clicking "Get started for free →" goes to `/dashboard` and shows "Dashboard — Auth0 Integration Pending", with no 404.
   - Visiting `/profile` redirects to `/`.
   - "Demo" opens the cream modal with "Demo Video" over a 16:9 iframe. The `✕`, a backdrop click and Escape each close it, playback stops, and page scrolling returns.
   - "How it works" goes to `/project_working.html` showing "OK working".
   - Repeat the checks in a narrow viewport through the hamburger menu.
   - Confirm the hero, video and crimson look are unchanged.

## After approval
Per your instruction I'll also copy this plan over `.claude/plans/1_plan-lp-button-working.md`. That file currently holds the outdated v1 plan, and plan mode only lets me edit the file at this path.
