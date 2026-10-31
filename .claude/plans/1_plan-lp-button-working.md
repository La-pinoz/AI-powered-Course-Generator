# Plan: Landing page buttons, Warm Cream modals, `/project_working.html`, `/profile` placeholder

Spec: `.claude/specs/1_lp-button-working.md`

## Context

The landing page (`client/src/pages/LandingPage.jsx`) already has an `activeModal` state, but every button opens a dark `#121212` modal filled with leftover AI Studio copy ("Pitch us an idea", "Mainframe Labs", etc.). The spec replaces this with three Warm Cream modals (`login`, `signup`, `demo`), a static `/project_working.html`, and a `/profile` placeholder route. Login, Sign Up and Google are mock only: they redirect to `/profile`, with no Auth0 or backend.

The hero layout, the video background, the typography and the crimson look stay untouched (spec non-goals).

## Current state (verified)

- `client/src/App.jsx`: routes are `/` (LandingPage) and `*` redirecting to `/`.
- `client/src/main.jsx`: `BrowserRouter` is already mounted, so `useNavigate` works in `LandingPage`.
- `LandingPage.jsx`:
  - `navItems` holds "How it works" (`operate`) and "Demo" (`labs`).
  - "Log in" opens `contact`, and "Sign up free" and the hero CTA open `pitch`. These buttons appear in both the desktop header and the mobile overlay.
  - Modal JSX is at lines 335-590 and covers `pitch`, `work`/`openings`, `hello`/`contact`, `operate`/`studio`, `labs` and `shop`.
  - The toast, `handleCopyEmail`, `copiedToast` and `formSubmitted` exist only for those old modals.
  - The Escape handler (lines 123-133) already closes the modal and the mobile menu.
- `client/public/` has no `project_working.html`.
- Tailwind v4 is available. Chakra is not mounted, so the modals use Tailwind arbitrary-value classes (e.g. `bg-[#FAF6EE]`).

## Files to create

1. **`client/src/components/LandingModals.jsx`** (new): holds all three modals.
   - `export const DEMO_YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"; // TODO: Replace with final project demo video URL`, at the top of the file.
   - Default export `LandingModals({ activeModal, setActiveModal, onAuthSuccess })`. It returns `null` when `activeModal` is `null`.
   - Shared shell:
     - Overlay: `rgba(28,10,8,0.45)` with `backdrop-filter: blur(10px)`. Clicking the overlay closes the modal, and the card calls `e.stopPropagation()`.
     - Card: `#FAF6EE`, `1px solid #E5DEC9`, radius 20px, shadow `0 25px 50px -12px rgba(0,0,0,0.35)`. It also gets `role="dialog"`, `aria-modal` and `aria-labelledby`.
     - `✕` close button, top-right, `#5C5852` with hover `#1F2421`, setting `activeModal` to `null`.
   - Effects inside the component:
     - Body scroll lock: set `document.body.style.overflow = 'hidden'` while open, and clean up with `'unset'`.
     - Escape-to-close `keydown` listener. `LandingPage` also closes the mobile menu on Escape. The two handlers are harmless together, but I'll keep only one handler per concern.
   - Small internal pieces: `ModalShell`, `LoginModal`, `SignupModal`, `DemoModal`, `GoogleButton` (inline official multicolour "G" SVG, no X/Twitter) and `Field` (label plus input in the Oat Sand style).
   - **Login**:
     - Eyebrow `AI-POWERED COURSE GENERATOR ✳` (uppercase, 0.75rem, tracking 0.08em, `#5C5852`) and heading "Welcome back".
     - Fields: Email Address (`type="email"`, required, placeholder `you@example.com`) and Password (`type="password"`, required, placeholder `Enter your password`).
     - Full-width pill "Log In" (`#3A5233`, hover `#2D4027`, white, weight 600).
     - An "or" divider, then the Google button.
     - Footer "Don't have an account? **Sign up for free**" with `type="button"` that sets `signup`.
   - **Sign Up**:
     - Same eyebrow, heading "Create your free account".
     - Fields: Your Name (`type="text"`, required, placeholder `Enter your full name`), Email Address (`type="email"`, required, placeholder `you@example.com`) and Choose Password (`type="password"`, required, placeholder `Create a password`).
     - "Create Account" pill, then Google.
     - Footer "Already have an account? **Log in**" with `type="button"` that sets `login`.
   - **Demo**:
     - Title strictly "Demo Video", with no eyebrow and no subtitle.
     - A `16:9` container (`aspect-video`, radius 12px, `overflow-hidden`, `bg-black`) holding `<iframe src={DEMO_YOUTUBE_EMBED_URL} title="Demo Video" allowFullScreen className="w-full h-full" />`.
     - Closing sets `activeModal` to `null`, which unmounts the iframe and stops playback.
   - Form `onSubmit`: `e.preventDefault()`, then `onAuthSuccess()`. The Google button also calls `onAuthSuccess()`.
   - Colors: heading `#1F2421`, body and labels `#5C5852`, input `#F0EAE1` with `1px #DED6C8` border, text `#1F2421`, placeholder `#8C857B`, focus ring `#3A5233`.

2. **`client/src/pages/ProfilePage.jsx`** (new): a simple default-export component rendering `Profile Page — Database & Auth Integration Pending`. It uses a plain centered layout and sets no auth or data behaviour.

3. **`client/public/project_working.html`** (new): a minimal valid HTML5 document (`<!doctype html>`, `lang`, `meta charset`, `<title>`). The `<body>` contains only `OK working`.

## Files to edit

4. **`client/src/App.jsx`**: import `ProfilePage` and add `<Route path="/profile" element={<ProfilePage />} />` before the `*` catch-all.

5. **`client/src/pages/LandingPage.jsx`**:
   - Imports:
     - Add `useNavigate` from `react-router-dom`.
     - Add `LandingModals` from `../components/LandingModals.jsx`. Relative imports need the `.jsx` extension in this repo's style.
   - State:
     - Keep `activeModal`, now only `'login' | 'signup' | 'demo' | null`.
     - Remove `copiedToast`, `formSubmitted` and `handleCopyEmail`.
     - Add `const navigate = useNavigate()` and `const handleAuthSuccess = () => { setActiveModal(null); navigate('/profile'); }`.
   - Nav items:
     - Replace `navItems` with "How it works" (`<a href="/project_working.html">`, a real navigation, spec Action 2) and "Demo" (button setting `demo`).
     - Update both the desktop nav and the mobile overlay. The `<a>` is styled like the existing nav buttons, and in the mobile overlay it closes the menu on click.
   - Button wiring:

     | Button | Location | Action |
     |---|---|---|
     | Hero "Get started for free →" | hero | `setActiveModal('login')` (was `pitch`) |
     | "Log in" | desktop header and mobile overlay | `setActiveModal('login')` (was `contact`) |
     | "Sign up free" | desktop header and mobile overlay | `setActiveModal('signup')` (was `pitch`) |
     | "How it works" | desktop header and mobile overlay | link to `/project_working.html` |
     | "Demo" | desktop header and mobile overlay | `setActiveModal('demo')` |

   - Delete the toast block and the whole old modal block (lines 320-590), including the "Pitch us an idea" / "Mainframe Labs & Ventures" markup. Render `<LandingModals activeModal={activeModal} setActiveModal={setActiveModal} onAuthSuccess={handleAuthSuccess} />` in its place.
   - Keep the Escape effect, but it only needs to close the mobile menu (the modal handles its own Escape).
   - Leave the video scrub effect, hero section, header markup and typography unchanged.

6. **`CLAUDE.md`** (optional, a few lines): update the Status section. It should note that the landing page buttons, the Warm Cream modals (`components/LandingModals.jsx`), the `/profile` placeholder and `public/project_working.html` exist, and that auth is mocked until the Auth0 session.

## Decisions I'm making (tell me if you disagree)

- I'm removing the other old dark modal branches (`work`, `hello`, `operate`, `labs`, `shop`) as well as `pitch`. No button reaches them any more, and the spec limits `activeModal` to three values. This also drops the fake "Mainframe" copy.
- "How it works" is a plain `<a href>`, not React Router, so the browser loads the static file straight from `public/`.
- `DEMO_YOUTUBE_EMBED_URL` lives in `LandingModals.jsx`, which exports it as the spec says. Exporting a constant alongside a component costs Vite fast refresh for that one file (it falls back to a full reload).

## Verification

1. `cd client && npm run build` must pass with no JSX or bundler errors (spec acceptance criterion).
2. `npm run lint` (oxlint) should show nothing new.
3. In `npm run dev`, walk through the acceptance checklist:
   - Hero "Get started for free →" and "Log in" open the cream Login modal.
   - "Sign up free" opens the Sign Up modal. The footer links switch Login and Sign Up both ways.
   - Submitting either form, or clicking Google, lands on `/profile` with the placeholder text (no 404).
   - "How it works" loads `/project_working.html` showing only "OK working".
   - "Demo" shows "Demo Video" over a 16:9 iframe. Closing it stops playback.
   - The `✕`, a backdrop click and Escape all close the modal. The body doesn't scroll while a modal is open, and scrolling returns afterwards.
   - There is no X/Twitter button anywhere, and no leftover black "Pitch us an idea" modal.
   - Repeat the button checks in a narrow viewport for the mobile hamburger overlay.
   - Confirm the hero layout, the video and the crimson look are unchanged.

## Note on plan location

You asked for this plan at `.claude/plans/1_plan-lp-button-working.md`. Plan mode only lets me write to the file above, so after approval I'll copy it to that path.
