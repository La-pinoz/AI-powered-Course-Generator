# Spec 5 — Session 1: Lesson Content & Lesson Page

Nov 1, 2026 · @AI User

## Purpose

Session 1 replaces "Lesson pages are coming soon." with a real lesson page: an AI-written explanation, a self-check quiz and a "Mark as completed" button, backed by lesson content that is generated once and saved. Every later feature (course page, videos, Hinglish audio, PDF) reads from the content saved here, so this session builds the foundation and leaves labelled slots for the rest.

**Decision: lessons are written in the background, in order, right after the course is created.** The user lands on Lesson 1 as soon as it is ready (usually seconds) and never waits per lesson again in practice. If they open a lesson that is not written yet, it jumps to the front of the queue and the page shows "Preparing this lesson…". This keeps the course-creation wait unchanged (it already has a 90 s budget) and means one failed lesson can be retried alone instead of failing the whole course.

This spec is numbered Spec 5 to follow the existing specs 1–4 in the repo; rename if your numbering differs.

## Where this session fits

The agreed design has two pages. Session 1 builds the lesson page and the content behind it; everything else gets a reserved slot.

| Page | Section | Shown when | Built in |
| --- | --- | --- | --- |
| Lesson `/courses/:courseId/lessons/:lessonId` | Explanation (text + examples) | Always, open by default | **Session 1** |
| Lesson | Quiz (self-check, not saved) | Always | **Session 1** |
| Lesson | Hinglish audio | Course was created with Hinglish audio on | Session 4 (placeholder in S1) |
| Lesson | Mark as completed + Previous / Next | Always | **Session 1** |
| Course `/courses/:courseId` | Course explanation (description + modules and lessons) | Always | Session 2 |
| Course | Side quests, grouped by module | Course was created with Side Quest on | Session 2 |
| Course | One YouTube video per module | Always | Session 3 |
| Course | Download whole course as PDF | All lessons written | Session 5 |

Session order:

1. Lesson content and lesson page (this spec)
2. Course page: explanation, side quests, sidebar course name opens it
3. Per-module YouTube videos
4. Hinglish audio on lessons
5. Course PDF
6. Deployment (Render + Vercel), CI/CD, README

## Scope

**In scope**

- Lesson content generation with Gemini: objectives, explanation blocks with examples, 4–5 MCQs with explanations, a short summary and a video search phrase.
- A background queue that writes every lesson of a new course in order, with on-demand priority, retry and restart recovery.
- Backfill for courses created before this session (e.g. "Introduction to Agentic AI"): their lessons are queued the first time one is opened.
- Lesson API endpoints, plus lesson readiness counts on existing course endpoints.
- The lesson page: header, collapsible sections built from a section registry, explanation renderer, quiz, Hinglish audio placeholder, Mark as completed, Previous / Next.
- After "Generate course", go straight to Lesson 1 (temporary until the course page exists).
- Server tests for the new service, queue and endpoints.

**Out of scope (later sessions)**

- Course page, side quests, opening the course page from the sidebar (Session 2).
- YouTube lookup and embed (Session 3).
- Hinglish translation and text-to-speech (Session 4).
- PDF export (Session 5).
- Deployment and CI/CD (Session 6).
- Saving quiz answers or scores; quiz never affects progress.
- Sidebar "ready / preparing" indicators per lesson (nice to have; may be added in Session 2).
- Changes to the landing page (must not change) or to course-outline generation, apart from enqueueing lessons after save.

## Data model changes

The Lesson model already reserves `content: []` and `isEnriched: false`; this session fills them and adds a lifecycle. Fields marked *reserved* are added now with a `null` default and are not read or written until their session, so later sessions need no migration.

**Lesson**

| Field | Type | Purpose | Used by |
| --- | --- | --- | --- |
| `status` | `'pending' \| 'generating' \| 'ready' \| 'failed'`, default `'pending'` | Lifecycle of the content | S1 |
| `content` | array of blocks (next section) | Explanation + quiz | S1, S5 (PDF) |
| `isEnriched` | Boolean | Set `true` together with `status: 'ready'` (keeps its existing meaning) | S1 |
| `summary` | String, 2–3 sentences | One-paragraph recap of the lesson | S2 course page, S3 module video query, S4 audio intro |
| `videoQuery` | String | YouTube search phrase written with the content | S3 |
| `contentVersion` | Number, `1` | Lets future format changes detect old lessons | S1+ |
| `generationStartedAt` | Date | Detects a stuck `generating` lesson after a restart | S1 |
| `generatedAt` | Date | When content became ready | S1 |
| `attempts` | Number, default 0 | Background attempts so far | S1 |
| `lastError` | String, server-only, never sent to the client | Debugging | S1 |
| `audio` | *reserved*, `null` → `{status, url, durationSec, generatedAt}` | Hinglish audio | S4 |

`objectives` from the outline are passed to the AI and kept as they are, so the sidebar, outline and lesson page always agree.

Add an index on `{ course: 1, status: 1 }` for the queue's recovery scan.

**Module**

| Field | Type | Used by |
| --- | --- | --- |
| `video` | *reserved*, `null` → `{query, videoId, title, channelTitle, fetchedAt}` | S3 |
| `sideQuest` | *reserved*, `null` → `{items: [{kind: 'concept' \| 'practice', title, body, searchTerms}], generatedAt}` | S2 |

**Course**: no new fields. Readiness counts are computed from lessons in the outline endpoint, so nothing denormalised can drift.

## Lesson content format

`content` is an ordered array of typed blocks, following roadmap Milestone 6. Explanation blocks come first and all `mcq` blocks come last; the page puts non-quiz blocks in the Explanation section and `mcq` blocks in the Quiz section.

| Block `type` | Fields | Notes |
| --- | --- | --- |
| `heading` | `text` | Sub-heading inside the explanation (rendered as h3) |
| `paragraph` | `text` | Main prose |
| `list` | `ordered` (bool), `items` (string\[\]) | 2–8 items |
| `code` | `language`, `text` | Only when the topic is technical |
| `example` | `title`, `text` | Worked or real-world example; at least one per lesson |
| `callout` | `tone` (`tip` \| `note` \| `warning`), `text` | Common mistakes, rules of thumb |
| `mcq` | `question`, `options` (string\[4\]), `answer` (0–3), `explanation` | 4–5 per lesson |

There is deliberately no `video` block: the video moved to module level, and its search phrase lives in `lesson.videoQuery`.

**Inline text.** Strings are plain text. Only `**bold**` and `` `inline code` `` are allowed; the client parses those two into React elements and never uses `dangerouslySetInnerHTML`. No links in AI-written text, because the AI invents URLs.

**Gemini schema.** Gemini's `responseSchema` handles one flat object better than a union of types. Use a single block object with `type` as an enum and every other field optional, then validate per type on the server and drop fields that do not belong to that type before saving.

**Validation** (`validateLessonContent`, mirrors `validateOutline`; a failure is a "bad-output" error and is retried):

- 3–40 explanation blocks, including at least one `paragraph` and one `example`.
- 4–5 `mcq` blocks, all after the last explanation block.
- Each `mcq`: 4 distinct non-empty options, integer `answer` in 0–3, non-empty `explanation`.
- Length caps: heading 120, paragraph / example / callout text 1,200, list item 300, code 3,000, question 300, option 200, explanation 600 characters.
- `code.language` lower-cased and checked against a short allowlist; anything else becomes `text`.
- `summary` 1–400 characters; `videoQuery` 3–100 characters.
- Unknown block types are rejected on the server. The client renderer skips unknown types, so later sessions can add block types without breaking older clients.

Example:

```json
{
  "summary": "An AI agent is a program that perceives, decides and acts in a loop toward a goal...",
  "videoQuery": "what are AI agents perceive reason act loop explained",
  "content": [
    { "type": "paragraph", "text": "An **AI agent** is software that pursues a goal by ..." },
    { "type": "example", "title": "A travel-booking agent", "text": "Given 'book me a flight to Goa', it ..." },
    { "type": "callout", "tone": "tip", "text": "A chatbot answers; an agent acts." },
    { "type": "mcq", "question": "What separates an agent from a chatbot?",
      "options": ["It uses an LLM", "It takes actions toward a goal", "It has a UI", "It is trained on more data"],
      "answer": 1, "explanation": "Both may use LLMs; the agent decides and acts in a loop." }
  ]
}
```

## Lesson generation

Each lesson is written by one Gemini call, run by an in-process queue that starts right after the course is saved and is re-started whenever someone opens the course. Every lesson moves through four states:

&#91;embedded content: lesson status lifecycle · 4 states\]

Only the user's Retry or a restart sends a lesson back to Pending; a Ready lesson is never rewritten.

### Prompt

`buildLessonPrompt({ course, module, lesson, prevLesson, nextLesson })` in a new `lessonGenerationService.js`:

- **Inputs:** course title and description, module title, lesson title and objectives, and the titles of the previous and next lessons so the AI does not repeat or jump ahead.
- **Prompt-injection guard:** every title and description sits inside a `<<<DATA … DATA>>>` block with the instruction to treat it as subject names only. These strings came from the user's topic, so the same rule as the outline prompt applies.
- **Rules for the AI:** cover every objective; write 400–900 words of explanation for a motivated beginner; include at least one concrete example; add code only when the topic is technical; write 4–5 MCQs that test understanding rather than recall, with plausible wrong options and an explanation of the right one; write a 2–3 sentence summary; write a specific English YouTube search phrase without quotes or operators; return raw JSON only.
- The Side Quest and Hinglish flags are **not** passed; those features have their own generation later.

### Shared Gemini client

Move the model rotation, timeouts, backoff and failure classification out of `courseGenerationService.js` into a shared `geminiClient.js`, used by both services with no behaviour change for outlines. Lessons get their own budget: `LESSON_ATTEMPT_TIMEOUT_MS` (default 60 s) and `LESSON_TOTAL_TIMEOUT_MS` (default 120 s), because the output is longer.

### Queue (`lessonQueue.js`)

- **One process, in memory**, like the existing 409 guard. Documented as a single-instance limitation.
- **Order:** lessons of a course run one at a time in module order, then lesson order.
- **Concurrency:** across courses, at most `LESSON_GEN_CONCURRENCY` Gemini calls at once (default 2), to stay under rate limits.
- **`ensureQueued(courseId)`:** adds a course's `pending` lessons if they are not already queued. Called after course creation, on every lesson GET and on every outline GET. This one entry point also covers old courses (backfill) and server restarts.
- **`prioritize(lessonId)`:** opening a lesson that is still `pending` moves it to the front of its course.
- **Claiming:** an atomic `findOneAndUpdate({ _id, status: 'pending' }, { status: 'generating', generationStartedAt: now, $inc: { attempts: 1 } })`, so a lesson can never be generated twice at once.
- **Saving:** `updateOne({ _id, status: 'generating' }, { content, summary, videoQuery, status: 'ready', isEnriched: true, generatedAt, contentVersion: 1 })`. If nothing matched, the lesson was deleted and the result is dropped.
- **Failure:** after the client's own retries are used up, set `status: 'failed'` and `lastError`, then move on to the next lesson. The queue never retries a failed lesson by itself; the user's Retry does.
- **Course deleted:** `deleteCourse` calls `lessonQueue.cancelCourse(courseId)`. The worker also checks the course still exists before each lesson.
- **Restart recovery:** on server start, reset lessons stuck in `generating` for more than 3 minutes back to `pending`. Nothing is auto-enqueued at boot; `ensureQueued` picks them up when someone opens the course. This also matters on Render's free tier, where a sleeping instance kills background work.

Upstream AI text is only logged, never sent to the client, as today.

## API changes

Two new endpoints and three small changes to existing ones. All of them keep the current rules: `checkJwt`, owner = `req.auth.payload.sub`, a missing, malformed or foreign id is always `404 {message}`, and every error body is `{message}`.

| Endpoint | Change | Behaviour |
| --- | --- | --- |
| `GET /api/courses/:courseId/lessons/:lessonId` | **New** | Returns the lesson (shape below). Calls `ensureQueued(courseId)` and, if the lesson is `pending`, `prioritize(lessonId)`. Returns 200 whatever the status; `content` and `summary` are included only when `ready`. `404` if the lesson is not in that course. `Cache-Control: no-store`, since the client polls it. |
| `POST /api/courses/:courseId/lessons/:lessonId/retry` | **New** | `failed` → sets `pending`, prioritizes it, returns `202 {status: 'pending'}`. `pending` / `generating` → `202` with no change. `ready` → `409 "This lesson is already ready."` |
| `GET /api/courses/:id/outline` | Extended | Each lesson gains `status`. The top level gains `lessonsReady`, `lessonsFailed` and `lessonsTotal` (used by the Session 5 PDF button). Calls `ensureQueued`. Content is still never included. |
| `POST /api/courses` | Extended | After `saveCourse` succeeds, calls `ensureQueued(course.id)` without awaiting it. The response is unchanged. |
| `DELETE /api/courses/:id` | Extended | Calls `lessonQueue.cancelCourse(id)` before the cascade. |
| `GET /api/courses` | Check | Each course summary must include `options: {sideQuest, hinglishAudio}`; add it if missing. The lesson page needs it to decide which sections to show. |
| `PATCH /api/courses/:id/progress` | Unchanged | The lesson page uses `{lessonId, completed}` and `{lessonId, makeCurrent: true}`. |

Lesson response:

```json
{
  "id": "…", "courseId": "…", "moduleId": "…",
  "moduleTitle": "Foundations of Agentic AI", "moduleOrder": 1,
  "title": "What are AI Agents", "order": 1,
  "objectives": ["…", "…"],
  "status": "ready",
  "summary": "…",
  "content": [ /* blocks */ ]
}
```

`videoQuery`, `attempts`, `lastError` and the reserved `audio` are not sent in Session 1. Mount the lesson routes as `routes/lessonRoutes.js` under `/api/courses/:courseId/lessons` with `mergeParams: true` and `validateObjectId` on both ids, following routes → controllers → services.

## Frontend

The lesson route gets a real page whose sections come from a registry, so later sessions add a section by adding one entry and one component.

### Routes and navigation

- `/courses/:courseId/lessons/:lessonId` → new `pages/LessonPage.jsx`.
- `/courses/:courseId` keeps `CoursePlaceholder` until Session 2.
- `CreateCourseForm`: on success, navigate to `/courses/<id>/lessons/<currentLessonId>`, falling back to `/courses/<id>`. Session 2 switches this back to the course page.

### Page layout

1. **Header:** "Module 1 · Foundations of Agentic AI", the lesson title as h2 ("Lesson 1: What are AI Agents"), then "In this lesson you will…" with the objectives. The TopBar h1 stays the course title.
2. **Section bars:** full-width collapsible bars, one per visible registry entry. Explanation is open by default; the rest start closed.
3. **Footer:** Mark as completed, then Previous / Next.

The text column is capped at about 760 px for readability.

### Section registry (`components/lesson/lessonSections.js`)

```js
export const lessonSections = [
  { id: 'explanation', title: 'Explanation', defaultOpen: true,
    isVisible: () => true, Component: ExplanationSection },
  { id: 'quiz', title: 'Quiz', subtitle: ({ lesson }) => `${quizCount(lesson)} questions · self-check`,
    isVisible: () => true, Component: QuizSection },
  { id: 'hinglish-audio', title: 'Hinglish audio', subtitle: 'Listen to this lesson explained in Hinglish',
    isVisible: ({ course }) => course.options?.hinglishAudio, Component: ComingSoonSection },
];
```

- `LessonSection` renders one bar: a heading (h3) wrapping a button with the title, subtitle and chevron, `aria-expanded` and `aria-controls`, using Chakra `Collapsible` like the sidebar.
- Use `lazyMount` so a section's component mounts only when first opened (this matters for the audio player later). Keep it mounted after that, so quiz answers survive closing the bar.
- Each `Component` receives `{ lesson, course }`.
- Open/closed state resets to the defaults when the lesson changes.

### Explanation renderer

- `components/lesson/LessonRenderer.jsx` maps `type` → component through a `blockComponents` object, following roadmap Milestone 6. It renders every non-`mcq` block in order and skips unknown types (with a `console.warn` in development only).
- `components/lesson/blocks/`: `HeadingBlock`, `ParagraphBlock`, `ListBlock`, `CodeBlock`, `ExampleBlock`, `CalloutBlock`, `MCQBlock`, plus `InlineText` (the `**bold**` / `` `code` `` parser).
- `CodeBlock`: monospace, horizontal scroll, a language label and a Copy button. Plain styling is acceptable; do not add a heavy syntax-highlighting dependency in this session.
- `ExampleBlock` and `CalloutBlock` are visually distinct cards using existing palette tokens (no hard-coded hex).

### Quiz (`QuizSection`)

- Each `MCQBlock` is a `fieldset` with the question as `legend` and four radio options, plus a "Check" button that is enabled once an option is picked.
- On Check: lock the options, mark the right answer (olive success) and a wrong pick (red danger) with an icon as well as colour, show the explanation, and announce "Correct" / "Not quite" in a polite live region.
- When every question is checked, show "You got 3 of 5" and a "Try again" button that resets the quiz.
- State is local only and resets on lesson change. Nothing is saved, and the quiz never changes progress.

### Loading, preparing and error states

| State | What the page shows |
| --- | --- |
| First fetch | Skeleton header and three skeleton bars |
| `pending` / `generating` | Real header (title and objectives are already known), then a card "Preparing this lesson… this usually takes 10–30 seconds" with `role="status"`. Polls every 3 s; pauses while the browser tab is hidden. |
| `failed` | "We couldn't write this lesson." with a Retry button → `POST …/retry`, then back to polling |
| Not found (404) | "Lesson not found" and Back to dashboard, as the placeholder does today |
| Network or auth error | The mapped message (same `messageFor` rules as the form) and Try again |

### Progress

- **Mark as completed:** a `PillButton` at the bottom, enabled once the lesson is `ready`. After a click it becomes "Completed ✓" with an Undo link that sends `completed: false`. Updates are optimistic in `CoursesContext` (sidebar ✓, card progress, stats line) and roll back with a toast on error.
- **Resume point:** when a ready lesson opens and it is not the course's `currentLessonId`, send `makeCurrent: true` in the background and update the context, so Continue Learning resumes here.
- **Previous / Next:** worked out from the cached outline across module boundaries ("Next: Core Architecture →"). On the last lesson, Next becomes Back to dashboard (Session 2: Course overview).
- **On lesson change:** scroll to top and move focus to the lesson h2.

### State and data

- New hook `hooks/useLesson.js(courseId, lessonId)` returning `{ status, lesson, error, retry, reload }`. It aborts stale requests when `lessonId` changes and stops polling on `ready`, `failed` or unmount.
- `CoursesContext` gains: a `lessons` cache of ready lessons keyed by id (Previous / Next back to a read lesson is instant; cleared for a course on delete), `setLessonStatus(courseId, lessonId, status)` to keep outline statuses fresh, and `setLessonCompleted(courseId, lessonId, completed)` / `setCurrentLesson(courseId, lessonId)` wrapping the progress PATCH.
- Keep the dark-only Chakra styling, palette tokens, `icons.jsx` SVGs, 44 px touch targets and reduced-motion handling already used across the dashboard.

## Reserved slots for later sessions

Each later piece has a named place to land. None of these slots is read or shown in Session 1, apart from the Hinglish placeholder bar.

| Session | Feature | Slot left in Session 1 | How it plugs in |
| --- | --- | --- | --- |
| 2 | Course page | `/courses/:courseId` route still on `CoursePlaceholder`; `lesson.summary` saved for every lesson | Replace the placeholder with `CoursePage`; show module → lessons with each lesson's summary; make the sidebar course name a link; switch the post-generate redirect and the last lesson's Next to the course page |
| 2 | Side quests | `Module.sideQuest` (reserved, `null`); the course stores `options.sideQuest` | Generate once per module (the queue can take a second job type), shown grouped by module on the course page; practice tips use search terms, not links |
| 3 | YouTube per module | `lesson.videoQuery` saved for every lesson; `Module.video` (reserved) | Build a module query from its lessons' `videoQuery` and titles, call the YouTube Data API on the server, store the chosen `videoId` in `Module.video` so search runs only once |
| 4 | Hinglish audio | `hinglish-audio` registry entry rendering `ComingSoonSection`; `lesson.audio` (reserved); `lazyMount` on sections | Swap the component for `HinglishAudioSection`; generate the translation and TTS when the bar is first opened and store the result in `lesson.audio` |
| 5 | Course PDF | Structured `content` blocks; `lessonsReady` / `lessonsTotal` on the outline | Build the PDF from the block data (not a screenshot): contents page from module and lesson titles, real selectable text. The button is enabled when `lessonsReady === lessonsTotal` and otherwise shows "Preparing… 12 of 22 lessons ready" |
| 6 | Deployment | Single-process queue documented; all new settings read from env with defaults | Add `LESSON_GEN_CONCURRENCY`, `LESSON_ATTEMPT_TIMEOUT_MS`, `LESSON_TOTAL_TIMEOUT_MS` to Render; the lazy `ensureQueued` copes with Render's free tier sleeping |

Rules that keep the slots usable: the renderer ignores unknown block types, `contentVersion` marks the content format, reserved fields default to `null` rather than being left out of the schema, and new sections only touch `lessonSections.js` plus their own component.

## Testing and acceptance

The session is done when every box below can be ticked on a fresh course and on the existing "Introduction to Agentic AI" course.

### Server tests (Vitest + supertest + mongodb-memory-server, Gemini mocked)

- `validateLessonContent`: accepts the example; rejects a missing example block, 3 or 6 MCQs, an MCQ before an explanation block, a duplicate option, `answer` out of range, over-long text and an unknown type; turns an unknown code language into `text`.
- `buildLessonPrompt`: titles appear only inside the data block; the previous and next lesson titles are included.
- Queue: runs lessons in module, then lesson order; `prioritize` jumps the line; at most N calls run at once; a lesson is never claimed twice; a failure marks only that lesson `failed` and the queue moves on; `cancelCourse` stops work and nothing is written for a deleted course; stale `generating` lessons are reset at startup.
- `GET …/lessons/:lessonId`: 200 with no `content` while pending, with `content` when ready; 404 for another user's course, a lesson from a different course and a malformed id; never leaks `lastError`.
- `POST …/retry`: `failed` → `pending`; `ready` → 409.
- Outline: per-lesson `status` and the ready / failed / total counts.
- The existing outline-generation retry tests still pass after the move to `geminiClient.js`.

### Manual acceptance

- [ ] Generate a course: the app lands on Lesson 1 and it shows content within about 30 s.
- [ ] While on Lesson 1, later lessons get written; opening Lesson 3 straight away shows "Preparing…" and then the lesson.
- [ ] The explanation renders headings, paragraphs, lists, at least one example card and code only on a technical topic.
- [ ] The quiz checks each answer, shows the explanation, gives a score and resets with Try again; nothing changes in progress.
- [ ] The Hinglish audio bar appears only for courses created with it on, and says "coming soon".
- [ ] Mark as completed updates the sidebar ✓, the card progress and the stats line; Undo reverses all three; a reload keeps the state.
- [ ] Opening a lesson makes it the resume point on the dashboard card.
- [ ] Previous / Next cross module boundaries; the last lesson offers Back to dashboard.
- [ ] Forcing a Gemini failure shows the failed state, and Retry recovers.
- [ ] Restarting the server mid-generation: reopening the course resumes the remaining lessons.
- [ ] Deleting a course mid-generation leaves no stray lessons and no errors in the log.
- [ ] Keyboard only: every bar, option, button and link is reachable with a visible focus ring; screen-reader announcements fire for "Preparing", quiz results and completion.
- [ ] Mobile width (below 768 px): bars, quiz options and footer buttons are at least 44 px tall and nothing overflows horizontally except code blocks.
- [ ] The landing page is unchanged.
