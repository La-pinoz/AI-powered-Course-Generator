# SPEC: Landing Page Navigation, Warm Cream Modals & Mock Auth Flow (React + Vite)

## 1. Objective & Bounded Scope

Replace the existing dark `"Pitch us an idea"` popup modal in the React (Vite) landing page with a unified, theme-consistent modal and navigation system covering all 5 header/hero interactive actions.

### Explicit Non-Goals (Do NOT Implement in This Session)

* Do **NOT** alter the landing page hero layout, crimson background color, typography, or the 3D character illustration.
* Do **NOT** include an `'X'` (Twitter) social login button anywhere in the Login or Sign Up modals (keep **Google only**).
* Do **NOT** integrate real backend database calls, MongoDB schemas, or Auth0 SDK in this session. All Login / Sign Up / Google clicks must perform a clean client-side redirect to `/profile`.
* Do **NOT** build out the full multi-step explanation UI inside `project_working.html` yet; it must strictly render `"OK working"` for this session.

---

## 2. React (Vite) Architecture & Routing Requirements

* **Static HTML Placement (`public/project_working.html`)**:
  * Because this is a Vite + React project, static HTML files served at the root URL path must live inside the `public/` folder (`public/project_working.html`).
* **Placeholder `/profile` Route**:
  * Since real authentication and database persistence will be added in a later session, ensure a route for `/profile` exists (via `react-router-dom` or pathname conditional rendering in `App.jsx`) that renders a simple placeholder view (e.g., `"Profile Page — Database & Auth Integration Pending"`) so redirecting to `/profile` after Login or Sign Up succeeds without a 404 error.
* **Configurable Demo Video Constant**:
  * Define a single constant at the top of the modal component:
    ```javascript
    export const DEMO_YOUTUBE_EMBED_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"; // TODO: Replace with final project demo video URL
    ```

---

## 3. Design System & Color Tokens (Warm Cream on Crimson Backdrop)

All modals (`Login`, `Sign Up`, and `Demo Video`) must replace the legacy dark black surface with the following palette designed to complement the crimson red background and the character's green sweater:

* **Backdrop Overlay**: `rgba(28, 10, 8, 0.45)` with `backdrop-filter: blur(10px)`
* **Modal Card Surface**: `#FAF6EE` (Warm Alabaster Cream)
* **Modal Border & Radius**: `1px solid #E5DEC9`, `border-radius: 20px`, `box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35)`
* **Top Eyebrow Label**: `AI-POWERED COURSE GENERATOR ✳` in `#5C5852`, uppercase, `0.75rem`, letter-spacing `0.08em`
* **Modal Heading**: `#1F2421` (Deep Charcoal-Pine), bold editorial sans-serif
* **Body & Label Text**: `#5C5852` (Warm Slate-Umber)
* **Input Field Surface**: `#F0EAE1` (Soft Oat Sand) with `1px solid #DED6C8` border, `#1F2421` input text, `#8C857B` placeholder text, and `#3A5233` focus ring
* **Primary Action Button (Pill CTA)**:
  * Background: `#3A5233` (Forest Moss Green)
  * Hover Background: `#2D4027`
  * Text: `#FFFFFF` (Pure White, font-weight `600`, `border-radius: 9999px`)
* **Close Button (`✕`)**: Top-right corner (`#5C5852`, hover `#1F2421`), closes active modal

---

## 4. Button-by-Button Functional Specification

### Action 1 & 4: `"Get started for free →"` (Hero CTA) & `"Log in"` (Top Navbar)

* **Trigger**: Clicking either the hero `"Get started for free →"` button or the top-right `"Log in"` navbar button.
* **Action**: Sets React state `activeModal = 'login'`.
* **Modal Content & Structure**:
  1. **Eyebrow**: `AI-POWERED COURSE GENERATOR ✳`
  2. **Heading**: `Welcome back`
  3. **Form Fields**:
     * `Email Address` (`type="email"`, required, placeholder: `you@example.com`)
     * `Password` (`type="password"`, required, placeholder: `Enter your password`)
  4. **Primary Submit Button**: Full-width pill button (`#3A5233`) labeled `Log In`.
  5. **Social Auth Divider**: Subtle divider (`or`) followed by **ONLY a Google login button** (with official Google 'G' SVG icon). **No 'X'/Twitter button.**
  6. **Footer Switcher**: `"Don't have an account? Sign up for free"` where `"Sign up for free"` is an underlined interactive button (`color: #3A5233`, `font-weight: 600`, `type="button"`) that switches state directly to `activeModal = 'signup'`.
* **Post-Submission Behavior (Mock UI Auth)**:
  * On `onSubmit` (after `e.preventDefault()`) or on clicking the Google button, close the modal and navigate the user to `/profile`.

### Action 5: `"Sign up free"` (Top Navbar Pill Button)

* **Trigger**: Clicking the top-right `"Sign up free"` button (or clicking `"Sign up for free"` inside the Login modal footer).
* **Action**: Sets React state `activeModal = 'signup'`.
* **Modal Content & Structure**:
  1. **Eyebrow**: `AI-POWERED COURSE GENERATOR ✳`
  2. **Heading**: `Create your free account`
  3. **Form Fields**:
     * `Your Name` (`type="text"`, required, placeholder: `Enter your full name`)
     * `Email Address` (`type="email"`, required, placeholder: `you@example.com`)
     * `Choose Password` (`type="password"`, required, placeholder: `Create a password`)
  4. **Primary Submit Button**: Full-width pill button (`#3A5233`) labeled `Create Account`.
  5. **Social Auth Option**: Google auth button ONLY (zero 'X'/Twitter icons).
  6. **Footer Switcher**: `"Already have an account? Log in"` where `"Log in"` is an underlined interactive button (`color: #3A5233`, `font-weight: 600`, `type="button"`) that switches state directly to `activeModal = 'login'`.
* **Post-Submission Behavior (Mock UI Auth)**:
  * On `onSubmit` (after `e.preventDefault()`) or on clicking the Google button, close the modal and navigate the user to `/profile`.

### Action 2: `"How it works"` (Top Navbar Link)

* **Trigger**: Clicking `"How it works"` in the top navigation bar.
* **Action**: Direct browser navigation (`<a href="/project_working.html">` or `window.location.href = '/project_working.html'`).
* **Target File Specification (`public/project_working.html`)**:
  * Create `public/project_working.html` inside the Vite project.
  * The file must be a minimal, valid HTML5 document whose `<body>` displays strictly:
    ```text
    OK working
    ```

### Action 3: `"Demo"` (Top Navbar Link)

* **Trigger**: Clicking `"Demo"` in the top navigation bar.
* **Action**: Sets React state `activeModal = 'demo'`.
* **Modal Content & Structure**:
  1. **Header Title**: Strictly display `Demo Video` at the top of the modal (do NOT include extra eyebrow text or subtitles).
  2. **Close Button (`✕`)**: Top-right corner. Clicking sets `activeModal = null`, which unmounts the React modal and **automatically stops YouTube audio/video playback**.
  3. **Video Container**:
     * Responsive `16:9` aspect-ratio container (`border-radius: 12px`, `overflow: hidden`, `background: #000`).
     * Renders `<iframe src={DEMO_YOUTUBE_EMBED_URL} title="Demo Video" allowFullScreen />`.

---

## 5. Modal Interaction & Accessibility Rules

* **Single Active Overlay State**: Manage via a single state variable in React: `const [activeModal, setActiveModal] = useState(null)` (`'login' | 'signup' | 'demo' | null`).
* **Dismissal Triggers**:
  1. Clicking the top-right `✕` icon.
  2. Clicking on the blurred backdrop outside the `#FAF6EE` modal card (`onClick` on overlay with `e.stopPropagation()` on the card).
  3. Pressing the `Escape` key (`keydown` listener in `useEffect`).
* **Body Scroll Lock**: While `activeModal !== null`, set `document.body.style.overflow = 'hidden'` and clean up (`'unset'`) in `useEffect`.

---

## 6. Acceptance Criteria & Verification Checklist

* [ ] Old black `"Pitch us an idea"` (`Mainframe Labs & Ventures`) modal markup is completely removed/replaced.
* [ ] Clicking `"Get started for free →"` or `"Log in"` opens the Warm Cream (`#FAF6EE`) **Login** modal with Forest Green (`#3A5233`) submit button.
* [ ] Login and Sign Up modals display **Google only** (zero `'X'`/Twitter icons).
* [ ] Clicking `"Sign up for free"` inside the Login modal switches smoothly to the **Sign Up** modal, and clicking `"Log in"` inside the Sign Up modal switches back to **Login**.
* [ ] Submitting the Login form, Sign Up form, or clicking the Google button navigates cleanly to the `/profile` placeholder view.
* [ ] Clicking `"How it works"` navigates to `/project_working.html` (served from `public/project_working.html`), displaying `"OK working"`.
* [ ] Clicking `"Demo"` opens the Warm Cream modal with the heading `"Demo Video"` on top and a 16:9 YouTube iframe using `DEMO_YOUTUBE_EMBED_URL`.
* [ ] `npm run build` succeeds with zero JSX or bundler errors.