# SPEC (v2): Landing Page Navigation Cleanup, Demo Modal & Auth0-Ready Entry Point (React + Vite)

## 1. Objective & Bounded Scope

Simplify the React (Vite) landing page so it is ready for Auth0 integration in the next session:

* Remove the in-app Login and Sign Up modals entirely. Auth0's hosted Universal Login page will provide both screens, so custom auth forms are no longer needed.
* Remove the `"Log in"` and `"Sign up free"` navbar buttons.
* Move `"Demo"` and `"How it works"` into the top-right slots those buttons used to occupy.
* Keep `"Get started for free →"` as the single entry point into the app. For this session it routes to a `/dashboard` placeholder; next session it will trigger Auth0.

### Explicit Non-Goals (Do NOT Implement in This Session)

* Do **NOT** alter the landing page hero layout, crimson background color, typography, or the 3D character illustration.
* Do **NOT** install or configure the Auth0 SDK (`@auth0/auth0-react`), and do **NOT** add any backend, database, or MongoDB code. Auth0 integration is the next session.
* Do **NOT** build any login, sign-up, or Google sign-in UI. Auth0's Universal Login will own those screens.
* Do **NOT** design the `/dashboard` page. It is a plain placeholder only.
* Do **NOT** build out the full multi-step explanation UI inside `project_working.html`; it must strictly render `"OK working"` for this session.

---

## 2. Things to Remove

If any of the following exist in the codebase (from earlier work), remove them completely, including their markup, state branches, styles, and handlers:

* The old dark `"Pitch us an idea"` (`Mainframe Labs & Ventures`) modal.
* The Login modal (`"Welcome back"` heading, email/password form, Google button, `"Sign up for free"` footer switcher).
* The Sign Up modal (`"Create your free account"` heading, name/email/password form, Google button, `"Log in"` footer switcher).
* The `"Log in"` navbar button.
* The `"Sign up free"` navbar pill button.
* The `/profile` placeholder route (replaced by `/dashboard`, see Section 3).
* Any `'login'` / `'signup'` values in the `activeModal` state and any code that sets them.

---

## 3. React (Vite) Architecture & Routing Requirements

* **Static HTML Placement (`public/project_working.html`)**:
  * Because this is a Vite + React project, static HTML files served at the root URL path must live inside the `public/` folder (`public/project_working.html`).
* **Placeholder `/dashboard` Route**:
  * Using `react-router-dom`, ensure a `/dashboard` route exists that renders a simple placeholder view (e.g., `"Dashboard — Auth0 Integration Pending"`) so navigation to `/dashboard` succeeds without a 404.
  * This route will become the protected main app (curriculum creation + course history) in later sessions. Leave it unprotected for now.
* **Single Auth Entry Handler**:
  * Implement the `"Get started for free →"` click logic in one named function (e.g., `handleGetStarted`) so the next session only has to swap its body:
    ```javascript
    // TODO (Auth0 session): replace with loginWithRedirect({ appState: { returnTo: '/dashboard' } })
    const handleGetStarted = () => navigate('/dashboard');
    ```
* **Configurable Demo Video Constant**:
  * Define a single constant at the top of the modal component:
    ```javascript
    export const DEMO_YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"; // TODO: Replace with final project demo video URL
    ```

---

## 4. Navbar Layout Change

### Before

* Center-right: `"How it works"` (text link), `"Demo"` (text link)
* Far right: `"Log in"` (text link), `"Sign up free"` (white pill button)

### After

* Center-right: **empty** (the old `"How it works"` and `"Demo"` links are moved, not duplicated)
* Far right, in the exact positions of the removed buttons:
  * `"Demo"` takes the old `"Log in"` slot, styled exactly as `"Log in"` was (plain white text link).
  * `"How it works"` takes the old `"Sign up free"` slot, styled exactly as `"Sign up free"` was (white oval/pill button with dark text, same padding, radius, and hover behavior).
* The logo (`AI-Powered Course Generator ✳`) on the left stays unchanged.
* Reuse the existing CSS classes/styles of the removed buttons rather than writing new ones, so the visual result matches the original layout pixel-for-pixel apart from the text.

---

## 5. Design Tokens (Demo Modal Only)

The Demo modal is now the only modal in the app. It keeps the warm cream palette:

* **Backdrop Overlay**: `rgba(28, 10, 8, 0.45)` with `backdrop-filter: blur(10px)`
* **Modal Card Surface**: `#FAF6EE` (Warm Alabaster Cream)
* **Modal Border & Radius**: `1px solid #E5DEC9`, `border-radius: 20px`, `box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35)`
* **Modal Heading**: `#1F2421` (Deep Charcoal-Pine), bold editorial sans-serif
* **Close Button (`✕`)**: Top-right corner (`#5C5852`, hover `#1F2421`), closes the modal

(The input field, form label, eyebrow, and green pill CTA tokens from v1 are no longer used and should not be kept as dead CSS.)

---

## 6. Button-by-Button Functional Specification

### Action 1: `"Get started for free →"` (Hero CTA)

* **Trigger**: Clicking the hero `"Get started for free →"` button.
* **Action (this session)**: Calls `handleGetStarted`, which navigates client-side to `/dashboard`.
* **Action (next session, for reference only)**: Will call Auth0 `loginWithRedirect()`; after a successful login or sign-up, Auth0 returns the user to `/dashboard`.

### Action 2: `"Demo"` (Top-right navbar, old `"Log in"` slot)

* **Trigger**: Clicking `"Demo"`.
* **Action**: Sets React state `activeModal = 'demo'`.
* **Modal Content & Structure**:
  1. **Header Title**: Strictly display `Demo Video` at the top of the modal (no eyebrow text or subtitles).
  2. **Close Button (`✕`)**: Top-right corner. Clicking sets `activeModal = null`, which unmounts the modal and **automatically stops YouTube audio/video playback**.
  3. **Video Container**:
     * Responsive `16:9` aspect-ratio container (`border-radius: 12px`, `overflow: hidden`, `background: #000`).
     * Renders `<iframe src={DEMO_YOUTUBE_EMBED_URL} title="Demo Video" allowFullScreen />`.

### Action 3: `"How it works"` (Top-right navbar, old `"Sign up free"` slot, white pill)

* **Trigger**: Clicking `"How it works"`.
* **Action**: Direct browser navigation (`<a href="/project_working.html">` or `window.location.href = '/project_working.html'`).
* **Target File Specification (`public/project_working.html`)**:
  * Create `public/project_working.html` inside the Vite project (if not already present).
  * The file must be a minimal, valid HTML5 document whose `<body>` displays strictly:
    ```text
    OK working
    ```

---

## 7. Modal Interaction & Accessibility Rules

* **Single Active Overlay State**: `const [activeModal, setActiveModal] = useState(null)` with values `'demo' | null` only. (Keeping it as a state variable rather than a boolean leaves room for future modals.)
* **Dismissal Triggers**:
  1. Clicking the top-right `✕` icon.
  2. Clicking on the blurred backdrop outside the `#FAF6EE` modal card (`onClick` on overlay with `e.stopPropagation()` on the card).
  3. Pressing the `Escape` key (`keydown` listener in `useEffect`).
* **Body Scroll Lock**: While `activeModal !== null`, set `document.body.style.overflow = 'hidden'` and clean up (`'unset'`) in `useEffect`.

---

## 8. Acceptance Criteria & Verification Checklist

* [ ] No `"Pitch us an idea"`, Login, or Sign Up modal markup, state, or styles remain in the codebase.
* [ ] The navbar no longer shows `"Log in"` or `"Sign up free"`.
* [ ] `"Demo"` appears in the old `"Log in"` position, styled as a plain white text link.
* [ ] `"How it works"` appears in the old `"Sign up free"` position, styled as the white oval/pill button.
* [ ] `"Demo"` and `"How it works"` no longer appear in their old center-right positions (no duplicates).
* [ ] Clicking `"Get started for free →"` navigates to `/dashboard`, which renders the placeholder text without a 404.
* [ ] `/profile` route no longer exists.
* [ ] Clicking `"Demo"` opens the Warm Cream modal with the heading `"Demo Video"` and a 16:9 YouTube iframe using `DEMO_YOUTUBE_EMBED_URL`.
* [ ] Closing the Demo modal (✕, backdrop click, or Escape) stops video playback and restores page scrolling.
* [ ] Clicking `"How it works"` navigates to `/project_working.html`, displaying `"OK working"`.
* [ ] No Auth0, backend, or database packages were added to `package.json`.
* [ ] `npm run build` succeeds with zero JSX or bundler errors.