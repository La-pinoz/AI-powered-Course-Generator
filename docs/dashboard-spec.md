# SPEC: Dashboard UI — Sidebar, Create Course, Continue Learning

Nov 1, 2026 · @AI User

Visual reference: `prompt-info/Gemini_Generated_Image_iqvihniqvihniqvi.png`. Where the image and this spec disagree, **this spec wins** (differences listed in Section 1.3).

## 1. Objective & Bounded Scope

Turn the `/dashboard` placeholder (SPEC v3, `client/src/pages/Dashboard.jsx`) into the real home screen: a persistent sidebar with the user's course tree, a top bar with a user menu, a **Create a New Course** form that calls the AI generator, and a **Continue Learning** section listing the user's courses with progress.

Builds on SPEC `2_auth0-implementation.md`: Auth0 login, `ProtectedRoute`, `apiRequest`, `POST /api/users/sync`, the `User` model keyed on `auth0Id`, and the `{ message }` error shape all stay as they are.

### 1.1 In scope

- Frontend: dashboard layout (sidebar + top bar), Create Course form with all its states, Continue Learning section, course delete, empty state, mobile drawer.
- Backend: `Course`, `Module`, `Lesson` models (including lesson progress), course endpoints (list, outline, create/generate, delete, progress update).
- AI generation of the **course outline only**: course title and description, module titles, lesson titles and objectives, via Gemini (`@google/genai`).
- A minimal protected placeholder route `/courses/:courseId` (and `/courses/:courseId/lessons/:lessonId`) so the post-generation redirect and sidebar lesson links have somewhere to land.

### 1.2 Explicit Non-Goals (Do NOT implement in this session)

- Do **NOT** build the real course or lesson page, and do **NOT** generate lesson content. Lessons are created with `isEnriched: false` and empty `content`.
- Do **NOT** generate Side Quest content or Hinglish audio. The two toggles are **stored on the course** and sent to the generator prompt as context only; producing that content is a later spec.
- Do **NOT** add course rename, search, sharing, tags, or PDF export.
- Do **NOT** change the landing page, its navbar, or the Auth0 setup.
- Do **NOT** add a light/dark theme switch. The dashboard is dark-only (Section 6.1).
- Do **NOT** stream generation progress from the server (no SSE or WebSockets). The request is a single `POST`.

### 1.3 Where this spec overrides the image

| Image shows | This spec requires |
| --- | --- |
| Loading pill and error banner visible at the same time, to the right of the toggles | **One** status at a time, in a full-width slot **below** the toggles (Section 4.4) |
| No visible Generate button | A full-width **Generate course** button below the toggles; it turns into the loading state while generating |
| Depth options show module counts only | Labels include lesson counts: `Quick · 3 modules`, `Standard · 4–5 modules`, `In-depth · 6 modules`, with helper text "Each module has 3–5 lessons" |
| Hamburger icon in the sidebar header on desktop | Hamburger appears **only below 768px**, in the top bar, and opens the sidebar drawer |
| ✦ sparkle in the bottom-right corner | Ignore; not part of the UI |
| `[Try Again]` as bracketed inline text | A real `Try again` button inside the error alert |

Everything else in the image (dark theme, purple accent, layout, copy, card contents, stats line wording, user menu contents) is the target design.

## 2. Existing Code This Builds On

| File | Today | After this spec |
| --- | --- | --- |
| `client/src/App.jsx` | `/dashboard` wrapped in `ProtectedRoute` | `/dashboard` and `/courses/*` become children of one protected layout route (Section 5.1) |
| `client/src/pages/Dashboard.jsx` | Syncs the user, shows welcome line, Log out, two empty sections | Only the page body: Create Course form + Continue Learning. User sync moves to the layout |
| `client/src/components/ProtectedRoute.jsx` | `withAuthenticationRequired` around children | Unchanged; wraps the layout |
| `client/src/components/LoadingSpinner.jsx`, `ErrorMessage.jsx` | Tailwind, cream background | Unchanged; still used for the full-page sync loading/error before the layout renders |
| `client/src/utils/api.js` | `apiRequest(path, { method, body, token })` | Unchanged. Must also handle `204` (it already does: JSON parse failure is swallowed) |
| `server/models/User.js` | `auth0Id` unique key | Unchanged. `Course.creator` stores the `auth0Id` string |
| `server/middlewares/errorHandler.js` | Passes through messages for `<500` and `502` | Also passes through `504` message (Section 7.6) |
| `server/config/env.js` | 5 required vars | Adds `GEMINI_API_KEY`, `GEMINI_MODEL` (Section 7.7) |

## 3. Page Layout

```text
┌────────────────────┬──────────────────────────────────────────────────────┐
│ ✧ Text-to-Learn     │  Dashboard                          [avatar Name ▾]  │  ← TopBar
│   AI Course Generator│                                                     │
│                     │  ┌ Create a New Course ───────────────────────────┐ │
│ [⌂ Dashboard]       │  │ topic input                                    │ │
│                     │  │ Course Depth  [Quick] [Standard] [In-depth]     │ │
│ YOUR COURSES        │  │ Features & Enhancements                         │ │
│ ▾ Intro to React…   │  │ ☐ Side Quest Mode                               │ │
│   ▾ Module 1        │  │ ☑ Hinglish audio                                │ │
│     ✓ L1 …          │  │ [ Generate course  ───────────── full width ]   │ │  ← status slot
│     ▌L2 … (current) │  └────────────────────────────────────────────────┘ │
│   ▸ Module 2        │  ┌ Continue Learning      3 courses • 13 of 49 … ┐   │
│ ▸ Basics of Copy…   │  │ [card] [card]                                  │   │
│ ▸ Natural Lang…     │  └────────────────────────────────────────────────┘   │
└────────────────────┴──────────────────────────────────────────────────────┘
   Sidebar (280px, fixed, scrolls independently)        Main (scrolls)
```

### 3.1 Sidebar

- Header: logo mark, **Text-to-Learn** (wordmark), subtitle **AI Course Generator**. Clicking the header goes to `/dashboard`.
- Nav: one link, **Dashboard** (home icon), active style when the route is `/dashboard`.
- **YOUR COURSES** heading, then the course tree, ordered like the Continue Learning cards (most recent activity first).
- **Course row**: book icon + course title (bold, truncated with ellipsis, full title in `title` attribute and tooltip). A chevron toggles expansion.
- **Module row**: `Module {n}: {title}`, its own chevron.
- **Lesson row**: `L{n}: {title}`, a link to `/courses/:courseId/lessons/:lessonId`.
  - Completed lesson: `✓` icon before the title.
  - **Current lesson**: highlighted row (filled background, as in the image). "Current" means:
    - on `/courses/:courseId/lessons/:lessonId`: that lesson;
    - everywhere else (including `/dashboard`): each course's `currentLessonId` (its resume point). Only the expanded course's highlight is visible.
- **Default expansion**: on load, the first course (most recent activity) is expanded, and so is the module containing its current lesson (or Module 1 if none). On a `/courses/:courseId/...` route, that course and module are expanded instead. Other courses start collapsed. The user's expand/collapse choices persist while they navigate inside the app (layout state), not across reloads.
- **Lazy loading**: the sidebar list comes from `GET /api/courses` (titles only). A course's modules and lessons are fetched with `GET /api/courses/:courseId/outline` the first time it is expanded, then cached in `CoursesContext`. While loading, show 3 skeleton rows under the course; on failure, an inline "Couldn't load modules. Retry" link.
- **Empty**: with no courses, show muted text "No courses yet" under the heading.
- Long trees scroll inside the sidebar; the header and Dashboard link stay fixed.

### 3.2 Top bar

- Page title `Dashboard` (h1) on the left (on course routes: the course title).
- Below 768px, a hamburger button on the far left opens the sidebar drawer.
- **User menu** on the right: trigger shows avatar (`user.picture`, falling back to initials) + `user.name` + chevron. Below 480px, the name is hidden and only the avatar shows.
- Menu content (matches the image):
  - name (bold) and email (muted), not clickable;
  - separator;
  - **Log out** (red text, logout icon) → `logout({ logoutParams: { returnTo: window.location.origin } })`.
- `user` comes from the `POST /api/users/sync` response, held in the layout.

### 3.3 Main content

- Max content width 1200px, padding 32px desktop / 16px mobile.
- Two stacked panels with rounded borders: **Create a New Course** (Section 4), then **Continue Learning** (Section 5).

## 4. Create a New Course Form

Heading **Create a New Course**, subtitle "Generate a custom, multi-module course instantly using AI."

### 4.1 Fields

| Field | Control | Rules | Default |
| --- | --- | --- | --- |
| Topic | Text input with floating label **Enter Topic Name**, placeholder "e.g. Intro to React Hooks" | Trimmed length 2–200 characters. Input has `maxLength={200}`. Character counter `n/200` appears from 180 characters on | empty |
| Course Depth | Single-select segmented choice (3 options) | Required, one of `quick`, `standard`, `in-depth` | `standard` |
| Side Quest Mode | Checkbox, label "Side Quest Mode", description "Provides extra topics to help understand the main subject better" | boolean | off |
| Hinglish audio | Checkbox, label "Hinglish audio: listen to lessons explained in Hinglish.", description "Each lesson includes an audio explanation in Hinglish." | boolean | off |

Depth options (label · helper):

| Value | Label | Generator target |
| --- | --- | --- |
| `quick` | Quick · 3 modules | exactly 3 modules |
| `standard` | Standard · 4–5 modules | 4 or 5 modules |
| `in-depth` | In-depth · 6 modules | exactly 6 modules |

Helper text under the options: "Each module has 3–5 lessons."

Shared limits live in one constants file per package (client `src/constants/course.js`, server `utils/courseConstants.js`) with identical values: `TOPIC_MIN = 2`, `TOPIC_MAX = 200`, `DEPTHS`, `LESSONS_PER_MODULE = { min: 3, max: 5 }`.

### 4.2 Generate button

- Full width of the form, directly **below** the two toggles. Label **Generate course**, primary purple.
- Pressing Enter in the topic input submits the form.

### 4.3 States (exactly one visible at a time)

The **status slot** is the area occupied by the Generate button. It shows exactly one of: the button, the loading bar, or the API error alert. The validation message is attached to the topic input and never appears together with the loading bar or API error.

```text
             submit, invalid               user edits topic
   ┌──────┐ ───────────────▶ ┌────────────┐ ──────────────▶ (back to idle when valid)
   │ idle │                  │ validation │
   └──────┘ ◀─────────────── └────────────┘
      │ submit, valid
      ▼
   ┌─────────┐   201   ┌─────────┐
   │ loading │ ──────▶ │ success │ → navigate to /courses/:courseId
   └─────────┘         └─────────┘
      │ 4xx/5xx/network
      ▼
   ┌───────────┐  "Try again" (same payload) → loading
   │ api error │  any field edited          → idle
   └───────────┘
```

| State | Topic input | Status slot | Other controls |
| --- | --- | --- | --- |
| **idle** | normal | Enabled **Generate course** button | enabled |
| **validation error** | red border, `aria-invalid="true"`, message below with warning icon: "Topic name must be between 2 and 200 characters." | Generate button (enabled) | enabled |
| **loading** | disabled | Disabled full-width bar, hourglass/spinner icon, text "Generating your course…" plus a phase hint that changes every ~6s: "(Planning modules…)" → "(Building modules…)" → "(Writing lesson titles…)" → "(Almost there…)" (stays on the last). The hints are cosmetic; the server does not report phases | all disabled; sidebar and cards stay usable |
| **success** | — | — (page navigates away immediately) | — |
| **api error** | normal, keeps the value | Red alert, warning icon: "Error generating course: {server message}" + **Try again** button | enabled |

Rules:

- Validation runs on submit only. Once in the validation state, it re-runs on every change and returns to idle as soon as the topic is valid. The topic is trimmed before checking and before sending.
- On validation failure, focus moves to the topic input.
- **Success**: add the new course to `CoursesContext` (prepend to the list, update stats), then `navigate('/courses/' + course._id)`. Form state does not need to survive the navigation.
- **Try again** re-sends the exact payload of the failed attempt. Editing any field instead returns the form to idle (the error disappears).
- Network failure (fetch throws) shows "Error generating course: Could not reach the server. Check your connection and try again."
- `401` from the API: show the error ("Please log in again.") — the Auth0 SDK handles re-login on the next token request.
- Double-submit protection: the button is disabled in loading, and the handler ignores submits while a request is in flight.
- Navigating away during loading is allowed; the request continues on the server and the new course appears in the list on the next fetch. No `beforeunload` prompt.

## 5. Continue Learning

### 5.1 Header

- Heading **Continue Learning** on the left; **stats line** on the right (wraps below the heading on narrow screens):
  - `{courseCount} course(s) • {completedLessonCount} of {lessonCount} lessons completed`
  - Singular/plural: "1 course", "1 of 1 lesson completed".
  - Hidden when there are no courses.

### 5.2 Course card

| Element | Content |
| --- | --- |
| Title | Course title, one line, ellipsis |
| Meta | `{moduleCount} Modules • {lessonCount} Lessons • Created {MMM d, yyyy}` (e.g. "Created Oct 28, 2026", formatted with `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`) |
| Progress bar | Purple fill = `completedLessonCount / lessonCount` |
| Progress text | `{completed}/{total} lessons completed` |
| ⋯ menu | Top-right icon button, menu with one item: **Delete** (red) |

- Clicking the card (anywhere except the ⋯ button) opens the course's resume point: `/courses/:courseId/lessons/:currentLessonId`, or `/courses/:courseId` if `currentLessonId` is null. The card is a link (keyboard: Enter).
- Order: `lastActivityAt` descending (newest first).
- Grid: 2 columns at ≥1024px main-area width, 1 column below. No pagination (all courses are shown).

### 5.3 Delete

1. ⋯ → **Delete** opens a confirm dialog: title "Delete course?", body "\"{title}\" and all its modules, lessons and progress will be permanently deleted.", buttons **Cancel** (default focus) and **Delete** (red).
2. Confirm → `DELETE /api/courses/:courseId`. The Delete button shows a spinner; both buttons are disabled.
3. `204` → close the dialog, remove the course from `CoursesContext` (card and sidebar entry disappear, stats update), show a toast "Course deleted".
4. Error → keep the dialog open with an inline error `{message}`; buttons re-enabled.
5. If the deleted course is the one in the current URL (`/courses/:courseId/...`), navigate to `/dashboard`.

### 5.4 Loading, error and empty states

- **Loading** (`GET /api/courses` in flight): 2 skeleton cards; sidebar shows 3 skeleton rows under YOUR COURSES.
- **Error**: inside the Continue Learning panel, the existing pattern: message + **Try again** (re-fetches). The sidebar shows "Couldn't load courses." with a small retry link. The Create Course form keeps working.
- **Empty** (new user, `courses.length === 0`): Chakra `EmptyState` in the panel: book icon, title "No courses yet", text "Enter a topic above and generate your first course in under a minute.", button **Create your first course** that scrolls to and focuses the topic input.

## 6. Frontend Implementation

### 6.1 Styling decision: Chakra UI v3, dark, scoped

- The dashboard is the first non-landing screen, so it is built with **Chakra UI v3** as CLAUDE.md intends. The landing page stays on Tailwind and must not change.
- Create `src/theme/system.js`: `createSystem(defaultConfig, defineConfig({ preflight: false, theme: { tokens/semanticTokens } }))`. `preflight: false` because Tailwind's preflight is already global; this prevents Chakra from restyling the landing page.
- Mount `<ChakraProvider value={system}>` **only inside the dashboard layout**, not in `main.jsx`.
- Dark only: the layout root element gets `className="dark"` so Chakra's built-in dark semantic tokens apply. No `next-themes`, no color-mode toggle.
- Accent: `colorPalette="purple"` on the layout root. Approximate palette from the image (define as semantic tokens):

| Token | Value | Use |
| --- | --- | --- |
| `bg.app` | `#0F0D14` | main background |
| `bg.sidebar` | `#15121C` | sidebar |
| `bg.panel` | `#1A1622` | panels, cards, menu |
| `border.subtle` | `#2C2636` | panel/card borders |
| `accent` | `#8B5CF6` | progress fill, checked boxes, selected depth border, current-lesson tint |
| `danger` | `#F87171` text on `#3A1A1F` bg | validation, API error, Delete |

All text/background pairs must meet WCAG AA (Section 9).

### 6.2 Routing (`src/App.jsx`)

```jsx
<Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/courses/:courseId" element={<CoursePlaceholder />} />
  <Route path="/courses/:courseId/lessons/:lessonId" element={<CoursePlaceholder />} />
</Route>
```

`/` and the `*` redirect are unchanged.

### 6.3 Component breakdown

```text
client/src/
├── theme/system.js                      // Chakra system (Section 6.1)
├── constants/course.js                  // TOPIC_MIN/MAX, DEPTHS (value, label, helper), LESSONS_PER_MODULE
├── hooks/useAuthedApi.js                // returns request(path, opts): getAccessTokenSilently() + apiRequest()
├── context/CoursesContext.jsx           // courses, stats, outlines cache, status; fetchCourses, fetchOutline, addCourse, removeCourse
├── layouts/DashboardLayout.jsx          // ChakraProvider + dark root; user sync (moved from Dashboard.jsx, same useRef guard,
│                                        //   same full-page LoadingSpinner / ErrorMessage + retry); CoursesProvider; Sidebar/Drawer, TopBar, <Outlet context={{ user }} />
├── components/dashboard/
│   ├── Sidebar.jsx                      // header, Dashboard link, "Your Courses"; rendered inline (≥768px) or inside SidebarDrawer
│   ├── SidebarDrawer.jsx                // Chakra Drawer (placement="start"), closes on route change
│   ├── CourseTree.jsx                   // list of CourseTreeItem, skeleton/error/empty states
│   ├── CourseTreeItem.jsx               // Collapsible course row → lazy fetchOutline → ModuleTreeItem[]
│   ├── ModuleTreeItem.jsx               // Collapsible module row → LessonTreeItem[]
│   ├── LessonTreeItem.jsx               // NavLink; ✓ if completed; highlight if current
│   ├── TopBar.jsx                       // h1 title, hamburger (<768px), UserMenu
│   ├── UserMenu.jsx                     // Chakra Menu: Avatar, name, email, Log out
│   ├── CreateCourseForm.jsx             // form state machine (Section 4.3), submits via CoursesContext.createCourse
│   ├── TopicInput.jsx                   // Chakra Field + Input, error text, counter
│   ├── DepthSelector.jsx                // Chakra RadioCard group (3 options)
│   ├── FeatureToggles.jsx               // two Chakra Checkbox with descriptions
│   ├── GenerateStatus.jsx               // status slot: button | loading bar | error alert + Try again
│   ├── ContinueLearning.jsx             // header + stats line, grid, loading/error/empty
│   ├── CourseCard.jsx                   // link card, meta, Chakra Progress, CourseCardMenu
│   ├── CourseCardMenu.jsx               // ⋯ Chakra Menu with Delete
│   ├── DeleteCourseDialog.jsx           // Chakra Dialog (role="alertdialog")
│   └── EmptyCourses.jsx                 // Chakra EmptyState
├── pages/Dashboard.jsx                  // <CreateCourseForm /> + <ContinueLearning />
└── pages/CoursePlaceholder.jsx          // course title + "Lesson pages are coming soon." + link back to /dashboard
```

- `CoursesContext` is the single source for both the sidebar and the cards, so create/delete updates both without a refetch.
- `createCourse(payload)` in the context calls `POST /api/courses`, then `addCourse(result.course)`; the form owns only its UI state.
- Format helpers (date, plurals, stats line) go in `src/utils/format.js`.

## 7. Backend

### 7.1 Folder additions

```text
server/
├── models/Course.js, Module.js, Lesson.js
├── routes/courseRoutes.js               // all routes behind checkJwt; mounted at /api/courses in server.js
├── controllers/courseController.js      // listCourses, getOutline, createCourse, deleteCourse, updateProgress
├── services/courseService.js            // Mongo reads/writes, always filtered by creator
├── services/courseGenerationService.js  // Gemini call, response schema, validation of the generated outline
├── middlewares/validateObjectId.js      // invalid :courseId → 404 { message: "Course not found." }
└── utils/courseConstants.js             // same values as client constants
```

### 7.2 Models

```javascript
// models/Course.js
const courseSchema = new mongoose.Schema({
  creator:     { type: String, required: true, index: true },   // User.auth0Id (Auth0 `sub`)
  topic:       { type: String, required: true, trim: true, minlength: 2, maxlength: 200 }, // what the user typed
  title:       { type: String, required: true, trim: true },    // AI-generated
  description: { type: String, trim: true },
  depth:       { type: String, enum: ['quick', 'standard', 'in-depth'], required: true },
  options: {
    sideQuest:     { type: Boolean, default: false },
    hinglishAudio: { type: Boolean, default: false },
  },
  modules:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }], // in order
  moduleCount: { type: Number, required: true },                 // denormalised for the list endpoint
  lessonCount: { type: Number, required: true },
  progress: {                                                    // ← lesson progress (Section 7.3)
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
    currentLesson:    { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
  },
  lastActivityAt: { type: Date, default: Date.now },            // created, or last progress change
}, { timestamps: true });
courseSchema.index({ creator: 1, lastActivityAt: -1 });

// models/Module.js
const moduleSchema = new mongoose.Schema({
  course:  { type: ObjectId, ref: 'Course', required: true, index: true },
  title:   { type: String, required: true, trim: true },
  order:   { type: Number, required: true },                    // 1-based
  lessons: [{ type: ObjectId, ref: 'Lesson' }],                 // in order
}, { timestamps: true });

// models/Lesson.js
const lessonSchema = new mongoose.Schema({
  course:     { type: ObjectId, ref: 'Course', required: true, index: true }, // for cascade delete
  module:     { type: ObjectId, ref: 'Module', required: true, index: true },
  title:      { type: String, required: true, trim: true },
  order:      { type: Number, required: true },                 // 1-based within the module
  objectives: [String],                                         // from the outline
  content:    { type: [mongoose.Schema.Types.Mixed], default: [] }, // filled by a later spec
  isEnriched: { type: Boolean, default: false },
}, { timestamps: true });
```

### 7.3 Lesson progress: where it lives and why

Progress is stored **on the course** (`Course.progress`), not on `Lesson` and not in a separate collection.

- Every course has exactly one owner (`creator`), so per-user progress and per-course progress are the same thing.
- The list endpoint needs `completedLessonCount` for every course. With progress on the course, that is `progress.completedLessons.length` from one query, with no join and no aggregation over lessons.
- Updates are atomic single-document ops: `$addToSet` / `$pull` on `completedLessons`, `$set` on `currentLesson`.
- If shared or public courses arrive later, move this into a `Progress { user, course, completedLessons, currentLesson }` collection. That is a migration for a later spec, not now.
- On creation, `currentLesson` is set to the first lesson of Module 1, so new courses have a resume point.

### 7.4 Endpoints

All require `checkJwt`. Every query filters by `creator: req.auth.payload.sub`. A course that does not exist **or belongs to someone else** returns `404 { message: "Course not found." }` (never 403, so ids don't leak). Errors are `{ message }`.

#### `GET /api/courses`

List for the sidebar and cards, sorted by `lastActivityAt` desc. One query with a projection (no populate).

```json
200 {
  "courses": [
    {
      "_id": "6720…",
      "title": "Intro to React Hooks",
      "moduleCount": 4,
      "lessonCount": 15,
      "completedLessonCount": 12,
      "currentLessonId": "6720…" ,
      "createdAt": "2026-10-28T09:12:00.000Z",
      "lastActivityAt": "2026-10-31T18:40:00.000Z"
    }
  ],
  "stats": { "courseCount": 3, "lessonCount": 49, "completedLessonCount": 13 }
}
```

#### `GET /api/courses/:courseId/outline`

Modules and lessons for the sidebar tree. Lesson `content` is **not** included.

```json
200 {
  "course": {
    "_id": "6720…",
    "title": "Intro to React Hooks",
    "currentLessonId": "6720…",
    "modules": [
      {
        "_id": "…", "order": 1, "title": "Foundation",
        "lessons": [
          { "_id": "…", "order": 1, "title": "Introduction to Hooks", "completed": true },
          { "_id": "…", "order": 2, "title": "useState & useEffect", "completed": false }
        ]
      }
    ]
  }
}
```

Errors: `404`.

#### `POST /api/courses`

Generate and save a new course.

```json
Request  { "topic": "Intro to React Hooks", "depth": "standard", "sideQuest": false, "hinglishAudio": true }
201      { "course": { /* same shape as one item of GET /api/courses */ } }
```

| Status | When | `message` |
| --- | --- | --- |
| `400` | `topic` missing, not a string, or trimmed length outside 2–200 | "Topic name must be between 2 and 200 characters." |
| `400` | `depth` not one of the three values | "Choose a course depth." |
| `400` | `sideQuest` / `hinglishAudio` present but not boolean | "Invalid course options." |
| `409` | This user already has a generation in progress | "A course is already being generated. Please wait for it to finish." |
| `502` | Gemini error, unparseable output, or outline fails validation (7.5) | "The AI couldn't generate this course. Please try again." |
| `504` | Gemini call exceeds 90s | "Course generation timed out. Please try again." |

Unknown body fields are ignored. Only `topic`, `depth`, `sideQuest`, `hinglishAudio` are read.

#### `DELETE /api/courses/:courseId`

Deletes the course, its modules and its lessons (`Lesson.deleteMany({ course })`, `Module.deleteMany({ course })`, then the course). `204` with no body. Errors: `404`.

#### `PATCH /api/courses/:courseId/progress`

Not called by the dashboard UI yet (the lesson page will call it), but built now so the ✓ marks, highlight and progress bars can be verified.

```json
Request  { "lessonId": "…", "completed": true, "makeCurrent": true }   // both flags optional; at least one required
200      { "progress": { "completedLessonIds": ["…"], "currentLessonId": "…", "completedLessonCount": 13 } }
```

- `lessonId` must belong to this course (`Lesson.exists({ _id, course })`), else `404 { message: "Lesson not found." }`.
- `completed: true` → `$addToSet`; `false` → `$pull`. `makeCurrent: true` → `$set currentLesson`. Always `$set lastActivityAt: now`.
- Neither flag → `400 { message: "Nothing to update." }`.

### 7.5 Generation service (`services/courseGenerationService.js`)

- `generateCourseOutline({ topic, depth, sideQuest, hinglishAudio })` → `{ title, description, modules: [{ title, lessons: [{ title, objectives: [string] }] }] }`.
- Uses `@google/genai` with JSON output (`responseMimeType: 'application/json'` + a `responseSchema` matching the shape above). Model name from `GEMINI_MODEL`.
- Prompt states: the topic, the module count for the depth (3 / 4–5 / 6), 3–5 lessons per module, beginner-to-advanced ordering. `sideQuest` and `hinglishAudio` are passed as context only (Section 1.2).
- The topic is user input: put it in a clearly delimited field of the prompt, never concatenated into instructions, and tell the model to treat it as a subject name only.
- Validate the result before saving: module count within the depth's range, every module has 3–5 lessons, all titles non-empty strings ≤ 200 chars. Failure → `502`.
- Timeout: abort after 90s → `504`.
- Concurrency: an in-memory `Set` of `sub`s with a generation in flight (single server process; noted as a limitation). Add before calling Gemini, remove in `finally`.
- Persistence: create the course, `insertMany` modules, `insertMany` lessons, then update `course.modules`, `module.lessons`, counts and `progress.currentLesson`. If any write fails, delete whatever was created for that course before re-throwing (`500`).

### 7.6 Error handler change

`errorHandler.js` currently hides the message for every status `>= 500` except `502`. Also pass through `504`, so the client can show "Course generation timed out." All other `5xx` stay generic.

### 7.7 Environment

- Add `GEMINI_API_KEY` and `GEMINI_MODEL` to `REQUIRED` in `config/env.js`, to the frozen `config` object, and to `server/.env.example` with placeholder text.
- Do **not** edit `server/.env`; tell the developer to add the two values.
- Update the env table in `README.md` and the Status section of `CLAUDE.md` once this lands.

## 8. Responsive Behaviour

| Width | Sidebar | Top bar | Create form | Continue Learning |
| --- | --- | --- | --- | --- |
| ≥1024px | Fixed 280px column | Title + user menu (avatar + name) | Topic input max 640px; depth options in one row | 2-column grid, stats line right of heading |
| 768–1023px | Fixed 240px column | same | Depth options in one row (wrap if needed) | 1 column |
| <768px | Hidden; **Drawer** from the left (280px, backdrop), opened by the top-bar hamburger | Hamburger + title + avatar-only menu trigger (name hidden <480px) | Full width; depth options stacked vertically, full width | 1 column, stats line below heading |

- The drawer closes on: lesson/Dashboard link click (route change), backdrop click, Escape, close button. Focus returns to the hamburger.
- The sidebar and main area scroll independently on desktop. On mobile only the page scrolls.
- No horizontal scrolling at 320px width. Touch targets are at least 44×44px on mobile (tree rows, ⋯ button, checkboxes, menu items).
- The Generate button and status slot stay full width at every size.

## 9. Accessibility

- **Landmarks**: `<aside>` with `<nav aria-label="Courses">` for the sidebar, `<header>` for the top bar, `<main id="main">` for content. A **Skip to main content** link (Chakra `SkipNavLink`) is the first focusable element.
- **Headings**: one `h1` (page title), `h2` for "Create a New Course" and "Continue Learning", `h3` for each course card title.
- **Course tree**: disclosure pattern, not ARIA `tree`. Nested `<ul>`s; each course/module toggle is a `<button aria-expanded aria-controls>`; lessons are links. The current lesson has `aria-current="page"` on lesson routes, and visually-hidden text "(continue here)" on the dashboard. Completed lessons have visually-hidden "(completed)" next to the ✓ (the icon is `aria-hidden`).
- **Form**:
  - topic `<label>` tied to the input; on error `aria-invalid="true"` and `aria-describedby` pointing to the error text;
  - depth is a radio group (`role="radiogroup"`, labelled "Course Depth"), arrow keys move between options;
  - checkboxes are real checkboxes, descriptions linked with `aria-describedby`;
  - loading: the status bar is a `role="status"` live region (`aria-live="polite"`); the button has `aria-disabled` / `disabled`; phase-hint changes are **not** announced each time (only the first "Generating your course…" is);
  - API error: `role="alert"`, and focus moves to the **Try again** button.
- **User menu, card ⋯ menu**: Chakra `Menu` (keyboard: Enter/Space opens, arrows move, Escape closes and returns focus). The ⋯ button has `aria-label="Options for {course title}"`.
- **Delete dialog**: `role="alertdialog"`, focus trapped, initial focus on **Cancel**, Escape cancels, focus returns to the ⋯ button (or to the grid heading if the card was removed).
- **Progress bars**: `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax={lessonCount}`, `aria-label="{title} progress"`; the visible "12/15 lessons completed" text is also present.
- **Avatar**: `alt=""` (name is shown next to it) or `alt={name}` when the name is hidden on small screens.
- **Contrast**: all text ≥ 4.5:1, large text and UI borders/focus rings ≥ 3:1 against the dark backgrounds. Visible focus ring (2px accent outline) on every interactive element.
- **Motion**: spinner and skeleton animations respect `prefers-reduced-motion` (no spin/pulse; static icon).

## 10. Acceptance Criteria & Verification Checklist

### Layout & navigation

- [ ] After login, `/dashboard` shows the sidebar (Text-to-Learn header, Dashboard link, YOUR COURSES), the top bar with `Dashboard` and the user menu, and the two panels.
- [ ] The user menu shows the signed-in user's name and email; **Log out** returns to the landing page and `/dashboard` then requires login again.
- [ ] Visiting the landing page after the dashboard shows it pixel-identical to before (Chakra does not restyle it).
- [ ] Below 768px the sidebar is hidden; the hamburger opens it as a drawer; clicking a lesson link, the backdrop or pressing Escape closes it.

### Sidebar tree

- [ ] Courses appear newest-activity first; the first course and the module holding its current lesson are expanded on load.
- [ ] Expanding a collapsed course fetches its outline once (visible in the Network tab only the first time).
- [ ] After `PATCH …/progress` with `completed: true` for a lesson and reloading, that lesson shows ✓ and the card's progress bar and stats line increase by one.
- [ ] After `PATCH …/progress` with `makeCurrent: true`, that lesson is the highlighted row.
- [ ] With zero courses the sidebar shows "No courses yet".

### Create Course form

- [ ] Default state: empty topic, **Standard** selected, both toggles off, full-width **Generate course** button below the toggles.
- [ ] Submitting "A" (or only spaces) shows "Topic name must be between 2 and 200 characters.", red border, focus on the input, and no request is sent.
- [ ] Typing a second character clears the error.
- [ ] The input cannot exceed 200 characters; a 201-character body sent directly to the API returns `400`.
- [ ] A valid submit shows the loading bar in place of the button, disables all fields, and shows no error at the same time.
- [ ] On success the browser lands on `/courses/:courseId`, and the new course is first in the sidebar and in Continue Learning on returning to `/dashboard`.
- [ ] The generated course has 3 modules for Quick, 4–5 for Standard, 6 for In-depth, each with 3–5 lessons (check in MongoDB).
- [ ] `options.sideQuest` and `options.hinglishAudio` in MongoDB match the toggles.
- [ ] With the server stopped (or `GEMINI_API_KEY` invalid), the status slot shows the error alert with **Try again** and no Generate button; **Try again** re-sends the same payload; editing the topic instead returns to the idle button.
- [ ] Two quick submits from two tabs: the second gets `409` and shows its message.

### Continue Learning

- [ ] Stats line reads e.g. "3 courses • 13 of 49 lessons completed" and uses singular forms for 1.
- [ ] Each card shows title, `N Modules • N Lessons • Created MMM d, yyyy`, a progress bar and `x/y lessons completed`.
- [ ] Clicking a card opens its resume lesson route.
- [ ] ⋯ → Delete → confirm removes the card and the sidebar entry, updates the stats line, and deletes the course, modules and lessons from MongoDB. Cancel deletes nothing.
- [ ] A new user sees the empty state; **Create your first course** focuses the topic input.

### API & security

- [ ] Every `/api/courses` route returns `401 { message }` without a valid token.
- [ ] User B calling `GET /outline`, `DELETE` or `PATCH /progress` on user A's course gets `404`, and A's data is unchanged.
- [ ] A malformed `:courseId` (e.g. `abc`) returns `404`, not `500`.
- [ ] Every error response body is exactly `{ message }`.

### Accessibility

- [ ] The whole flow (open drawer, expand tree, fill form, choose depth, toggle, generate, open ⋯ menu, delete) works with keyboard only.
- [ ] A screen reader announces the validation error, "Generating your course…", the API error, and the completed/current state of lessons.
- [ ] No axe DevTools violations of serious or critical impact on `/dashboard` in idle, validation-error, api-error and empty states.

### Code & housekeeping

- [ ] Server tests with Vitest + supertest (Gemini service mocked) cover: list, outline, create (valid, 400 cases, 409, 502, 504), delete (owner, non-owner, bad id), progress update. `npx vitest run` passes.
- [ ] `npm run build` and `npm run lint` in `client/` pass with zero errors; `npm run dev` in `server/` starts and exits with a clear message if `GEMINI_API_KEY` or `GEMINI_MODEL` is missing.
- [ ] `server/.env.example`, `README.md` and `CLAUDE.md` are updated; `.env` files are untouched.
