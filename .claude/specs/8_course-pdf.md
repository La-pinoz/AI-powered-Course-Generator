# Spec 8 — Course PDF Download

Nov 4, 2026

Roadmap Milestone 11 ("Download Lesson as PDF"), widened from one lesson to the whole course.

## Problem Statement

A learner who has generated a course can only read it inside the app, online and signed in. They can't study it offline, print it, or keep a copy of it. To have the material outside the app, they would have to copy it lesson by lesson, losing the Course → Module → Lesson structure.

## Solution

On any course route, a "Download PDF" button sits next to the course title in the top bar. Once every lesson in the course has been written, one click downloads a single, simple PDF of the entire course: black text on a white background, with modules as headings and lessons as subheadings, containing each lesson's explanation and its quiz with the answers.

Until the course is complete, the button is disabled and says why: lessons are still being prepared, or some failed and need a retry. While the PDF is being made, the button shows progress. The file is produced entirely in the browser, and the server doesn't change.

## User Stories

### Finding the button

1. As a learner, I want a "Download PDF" button next to the course title, so that it is clear the download covers the whole course.
2. As a learner, I want the button available on every course route (lesson pages and module video pages), so that I don't have to navigate anywhere to download.
3. As a learner on the dashboard home, I want no download button in the top bar, so that I am not offered a download with no course selected.
4. As a learner on a phone, I want the button to fit in the top bar as an icon, so that it doesn't crowd out the course title and user menu.
5. As a screen-reader user, I want the button to have a full spoken label in every state, so that I understand what it does and why it may be disabled.
6. As a keyboard user, I want to reach and activate the button with the keyboard and see a clear focus outline, so that I can download without a mouse.

### When a course isn't ready

7. As a learner whose course is still being written, I want the button disabled with a count such as "Preparing 12/22", so that I know a download is coming and how close it is.
8. As a learner waiting on a course, I want that count to update on its own, so that I don't have to open each lesson or reload to enable the button.
9. As a learner, I want the button to enable by itself when the last lesson finishes, so that I know straight away that I can download.
10. As a learner whose course has failed lessons, I want the button to say so, such as "2 failed", so that I understand why I can't download yet.
11. As a learner with failed lessons, I want the full message to tell me to open those lessons and retry, so that I know how to unblock the download.
12. As a learner who retried a failed lesson, I want the button to go back to showing progress and then enable, so that I don't have to reload after fixing it.
13. As a learner, I want the outline checks to pause while my tab is hidden, so that a background tab doesn't keep making requests.

### Exporting

14. As a learner, I want one click to produce the PDF with no dialog or options, so that downloading is effortless.
15. As a learner, I want progress such as "Exporting 5/22" during the export, so that I know a long course is still working.
16. As a learner, I want the button locked during an export, so that a double click doesn't produce two files.
17. As a learner, I want the dashboard to look unchanged during an export, so that I never see the white PDF copy flash on screen.
18. As a learner, I want to keep reading and moving around the course during an export, so that a long export doesn't block me.
19. As a learner, I want the file to download even if I move to another page during the export, so that navigating doesn't throw away the work.
20. As a learner, I want to be told if another course's PDF is still exporting, so that I understand why this button is unavailable for the moment.
21. As a learner, I want a clear error toast if the export fails, so that I am not left wondering where the file went.
22. As a learner whose export failed, I want to just click again, so that recovery needs no reload.
23. As a learner whose export failed, I want no partial file to be downloaded, so that I never mistake an incomplete PDF for the full course.
24. As a learner, I want the file named after the course, so that I can find it in my downloads folder.
25. As a learner whose course title contains characters filenames can't use, I want the download to still work, so that the title doesn't break it.

### What the PDF contains

26. As a reader, I want the course title at the top of the first page, so that I know what the document is.
27. As a reader, I want each module to be a clear heading with its number and title, so that I can see the course structure.
28. As a reader, I want each module after the first to start on a new page, so that the sections are easy to find while flipping through.
29. As a reader, I want each lesson to be a subheading with its number and title, so that I can find a lesson under its module.
30. As a reader, I want modules and lessons in the same order as the course, so that the PDF follows the intended learning path.
31. As a reader, I want a lesson's headings, paragraphs and lists kept in order, so that the explanation reads as it does in the app.
32. As a reader, I want `**bold**` and `` `code` `` in AI text rendered as real formatting, so that I never see raw markdown symbols.
33. As a reader, I want code blocks in a monospace font, in a bordered box with their language, with newlines kept and long lines wrapped, so that code stays readable and nothing is cut off at the page edge.
34. As a reader, I want examples and callouts in a thin bordered box, so that the important parts stand out.
35. As a reader, I want each lesson's quiz after its explanation, so that I can test myself on what I just read.
36. As a reader, I want each question's options labelled, followed straight away by the correct answer and explanation, so that the quiz is useful offline.
37. As a reader, I want Hindi or other non-Latin characters to appear correctly if a lesson contains them, so that no text comes out as blank or broken characters.
38. As a reader, I want page numbers on every page, so that I can keep my place on screen or in print.
39. As a reader printing the PDF, I want black text on a white background, so that it is legible and doesn't waste ink.
40. As a reader, I want the PDF to look the same every time, whatever the app's theme, so that it reads as a clean document.
41. As a reader, I want a line of text not to be cut in half at the bottom of a page, so that everything stays readable.
42. As a reader, I want a heading never left alone at the bottom of a page, so that it stays with the content it introduces.

### Unaffected behaviour

43. As a learner, I want exporting not to change my completed lessons or resume point, so that downloading doesn't count as studying.
44. As a learner, I want the quiz answers in the app to stay hidden until I check them, so that the PDF having answers doesn't spoil the in-app quiz.
45. As a visitor to the landing page, I want no extra loading cost from the PDF libraries, so that the first page stays fast.
46. As a learner with several courses, I want to download only courses I own, so that the existing ownership rule still applies.

## Implementation Decisions

### Decisions taken

| Question | Decision | Why |
| --- | --- | --- |
| What can be downloaded? | **The entire course only.** No single-lesson button | The owner's choice. A later lesson button can reuse the same code |
| How is the PDF made? | **`html2canvas` captures a hidden copy; `jsPDF` places the images on pages**, in the browser | Follows the roadmap, which replaces Spec 5's plan to draw selectable text from block data |
| Server changes? | **None.** Uses the existing outline and lesson routes | Ownership and error rules already apply there |
| Button location | **Next to the course title in the top bar** | Always visible, and it sits on the title that contains everything else |
| Incomplete courses | **Disabled until every lesson is `ready`** | A PDF is always complete |
| Layout | **Course title on page 1, Module 1 directly below it, each later module on a new page, lessons as subheadings, page numbers, no contents page** | Simple. Starting Module 1 on page 1 avoids a nearly empty first page |
| Content | **Explanation and quiz only.** No objectives, audio transcript or video | Same content for every course, whatever optional items have been generated |
| Quiz answers | **Inline, straight after each question** | The simplest option: a single pass draws each question with its answer |
| Look | **Black on white with thin bordered boxes.** No website colours or dark theme | The owner's choice. Boxes are simple with HTML capture |
| Page format | **A4 portrait with even margins** | A standard print size |

### Modules

- **Course exporter (new, deep module; the only test seam).** One entry point takes the course title, the ordered modules with their lessons, a way to get a lesson by id, and a progress callback. It either saves the file or rejects with an error. Internally it fetches lessons, renders the hidden copy, captures it, lays out pages, saves the file and always removes the hidden copy. Callers know nothing about `html2canvas` or `jsPDF`.
- **PDF view components (new).** Plain, non-interactive React components for the course title, module heading, lesson heading and every block type. They use only inline black-and-white styles and no Chakra components, theme tokens or dashboard block components, because those are dark, include Copy buttons and quiz controls, and the theme uses `color-mix`, which `html2canvas` may not handle. They reuse the existing inline-text parsing rule (only `**bold**` and `` `code` ``, never HTML). Unknown block types are skipped, as `LessonRenderer` does.
- **Export readiness (new, pure).** Takes the outline's lesson statuses and the export state, and returns the button's state, short label, full label and whether it is enabled. It lives with the exporter so it shares the test suite.
- **Download button (new).** A quiet outline button shown only on course routes, once the outline has loaded. It reads the readiness result, runs the exporter and shows failures through the existing toaster. It stays out of the way of the truncated title and the user menu. Its icon is an inline SVG with the other dashboard icons, because the project has no icon package.
- **Top bar (changed).** Renders the download button between the title and the user menu.
- **Courses context (changed).** Gains a way to refresh an outline's lesson statuses, because the existing `fetchOutline` serves its cache and never re-fetches. See "Outline refresh".
- **Client test setup (new).** A test script and Vitest with jsdom as development dependencies.

### Button states

| State | Condition | Enabled | Short label | Full label (tooltip and screen reader) |
| --- | --- | --- | --- | --- |
| Preparing | Any lesson `pending` or `generating` | No | Preparing 12/22 | Preparing… 12 of 22 lessons ready |
| Failed | None in progress, at least one `failed` | No | 2 failed | 2 lessons failed, open them to retry |
| Ready | All lessons `ready` | Yes | Download PDF | Download this course as a PDF |
| Exporting | This course is exporting | No | Exporting 5/22 | Exporting the PDF, 5 of 22 lessons |
| Busy elsewhere | Another course is exporting | No | Download PDF | Another course's PDF is still exporting |

- "Preparing" takes priority over "Failed" while any lesson is still in progress.
- Below the `md` breakpoint the button shows only its icon, and the full label is its accessible name. Touch targets stay at least 44px, as elsewhere in the dashboard.
- Disabled buttons don't reliably show tooltips or take focus, so the full label must stay reachable for mouse and keyboard users in the disabled states.

### Outline refresh

- While the current route's course has any lesson `pending` or `generating`, the client re-fetches the outline every 3 seconds, paused while the tab is hidden, matching lesson polling.
- Polling stops once no lesson is in progress. It starts again when a Retry puts a lesson back in progress.
- A refresh merges **only lesson statuses and the derived counts** into the cached outline. It must not overwrite `completed` or `currentLessonId`, because a late response could undo an optimistic progress update.
- Only the course on the current route is polled.
- This reuses the outline route, which already re-queues pending lessons.

### Export flow

1. The libraries are loaded by dynamic import on click, so they aren't in the landing page or dashboard's initial bundle. A failed chunk load counts as an export failure.
2. Lessons are fetched with the existing lesson route, a few at a time (about 4), using already cached ready lessons where available. Progress counts lessons processed, as the short label shows.
3. If a fetched lesson is not `ready`, or a request fails, the export stops with an error. No partial file is saved.
4. PDF view components render into a temporary container outside the visible page, in its own React root, at a fixed width matching the A4 content area. It is off-screen rather than `display: none`, because `html2canvas` needs real layout.
5. Each block is captured separately, because browsers limit canvas size, so a whole course can't be one capture. This also keeps normal page breaks between blocks.
6. Images are added to the PDF as JPEG at scale 2 and 0.75 quality, and each canvas is released once placed. Quality 0.75 was chosen after measuring: text stays crisp when zoomed in, and the worst-case test course below dropped from 21 MB at 0.9 to 16 MB.
7. Page rules:
   - A block that fits on the current page stays there. Otherwise it moves to a new page.
   - Each module after the first starts on a new page.
   - A heading (module, lesson, or heading block) is kept with the block after it.
   - A block taller than a full page is sliced across pages at page-height boundaries.
8. Page numbers are drawn on every page as PDF text. The PDF's title property is set to the course title.
9. The file is saved as `<course-title>.pdf`, with characters that filenames can't use removed and whitespace tidied. An empty result falls back to `course.pdf`.
10. The hidden copy is removed on success and on failure.

### Quiz format

Each question is numbered and its options are lettered A, B, C and so on. Below them come "Answer: <letter>. <option text>" and the explanation. The stored `answer` is a zero-based option index. A lesson with no questions has no quiz heading.

### Export state rules

- One export at a time per browser tab. The state lives at top-bar level, which stays mounted across dashboard routes, so moving to another page doesn't cancel the export.
- An export uses the data it started with. Signing out or closing the tab ends it.
- Failure shows a toast with the app's safe error message. Clicking again starts a fresh export.
- Exporting never calls the progress route, so completed lessons and the resume point don't change. Lessons fetched for the export may be added to the existing lesson cache.

### Not followed from the roadmap or earlier specs

| Item | Source | Why it changed |
| --- | --- | --- |
| Export of individual lessons | Roadmap feature table and Milestone 11 | The owner chose the whole course. The roadmap lists course export as an extension |
| `LessonPDFExporter` component | Roadmap Milestone 11 | The unit is now a course, and the export logic is separated from the button |
| Dark theme support and custom fonts | Roadmap Milestone 11 | The owner chose a plain black-and-white document |
| PDF built from block data with selectable text | Spec 5, later-sessions table | The owner chose the roadmap's image capture |
| Contents page | Spec 5, later-sessions table | Not needed for this version |
| Full "Preparing…" sentence as the visible label | Spec 5, later-sessions table | It doesn't fit in the top bar, so it became the tooltip and accessible label |

## Testing Decisions

### What makes a good test

A good test exercises the exporter from its public entry point and checks what a user would get: what content appears, in what order, on which page, and how failures behave. It must not depend on private helpers, internal state or the exact sequence of library calls beyond the observable result.

### The seam

There is **one seam: the course exporter's entry point**, run in Vitest with jsdom. Only the outside edges are mocked:

- `html2canvas` is mocked to return fake canvases with test-chosen heights, and to record the DOM element it was given. jsdom has no layout, so heights must come from the mock.
- `jsPDF` is mocked with a recording fake that shows pages added, images placed, text drawn and the saved filename.
- The lesson getter is a test function, so tests can return success, delay or failure.

The PDF view components run for real, so tests can read the actual text in each captured element.

### Exporter behaviours to test

- Modules, lessons and blocks are captured in course order.
- Module 1 stays on page 1, and each later module starts a new page.
- A block that doesn't fit moves to a new page, and a heading moves with the block after it.
- A block taller than a page is split across pages.
- Every page gets a page number.
- Captured text includes the explanation, quiz questions, lettered options, correct answer and explanation.
- Objectives, `videoQuery` and unknown block types are absent.
- `**bold**` and `` `code` `` are formatted, and HTML in AI text stays as plain text.
- Progress reports reach the total, and lesson fetching stays within the concurrency limit.
- A failed fetch, a lesson that isn't `ready` or a capture error rejects, saves nothing and removes the hidden copy.
- A successful export also removes the hidden copy.
- Filenames are sanitized, with the fallback working for an empty result.

### Readiness behaviours to test

Every state in the button states table, including "Preparing" taking priority over "Failed", with exact short and full labels. This is a pure function and needs no mocks.

### Prior art

The server's Vitest setup: mocks only at external services, real logic in between, and test names that describe behaviour. `lessonQueue.test.js` is the closest example for concurrency and failure behaviour.

### Manual check on a real course

jsdom can't show how the PDF looks, so before calling this done, export a real course in a browser and check:

- The appearance, boxes, code blocks and page breaks.
- Any non-Latin text.
- That no white copy flashes on screen.
- The phone layout of the button.
- **File size and export time on the largest course available.** Lower the image scale or quality if the file is too large.
- The outline count moves by itself on a newly generated course, and Retry brings the button back to progress.

Also run the client's lint and build, plus the new client tests.

## Out of Scope

- Single-lesson and single-module downloads.
- Selectable or searchable text in the PDF.
- A contents page, PDF bookmarks, clickable links or a cover page.
- Audio transcripts, video links, lesson objectives and the course description.
- Dark theme, theme selection, website colours, custom fonts and syntax highlighting.
- An answer key at the end, or a questions-only version.
- Partial downloads of incomplete courses.
- A "retry all failed lessons" action. Retry stays on each lesson page.
- A download button on Continue Learning cards, the sidebar or the unbuilt course page.
- Server-side generation, storage of generated PDFs, or any new API route.
- Cancelling an export in progress.

## Further Notes

- **Roadmap numbering:** this feature is Milestone 11. Milestone 10 is Hinglish audio, already built in Spec 6.
- **Dependencies:** `html2canvas` and `jspdf` are already in the client's dependencies, unused until now.
- **Measured:** the real exporter in headless Chrome, on a synthetic 30-lesson course with long lessons and unique text, took about 53 seconds and produced about 16 MB (roughly 0.5 MB per lesson). Real lessons are likely to differ, and this has not yet been measured on a real generated course.
- **Known limits:** Slicing a block taller than a page may cut through a line of text at the slice. That should be rare, since it mostly affects very long code blocks, and if the manual check shows it matters, long code can be split by lines before capture. Very large courses may use a lot of memory on low-end phones.
- **Trade-off to remember:** the sample resume bullet says export uses `jsPDF` and `html2canvas`, which stays true. Users can't search or copy text in the PDF, which is the cost of this approach.
- **After implementation:** update `CLAUDE.md`, including its Status section, the client test command and the note listing the course PDF as not built yet.
