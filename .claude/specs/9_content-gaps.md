# Spec 9 — Content Gaps: Key Topics, Tags, Further Reading, Create Form Clean-up

Nov 26, 2026

Branch 1 of 4 (suggested name `feature/roadmap-gaps`). Next: Spec 10 (CI), Spec 11 (deployment), Spec 12 (README and docs).

Closes the content gaps against the Hackathon Roadmap and its problem statement:

- Core Challenge: *"For each lesson: clear objectives, **key topics**, and **suggested readings or external links**"*, and the overview's "resource list".
- Milestone 5 / Milestone 8: course **`tags`** in the schema and in the `generateCoursePrompt` output.

It also removes the two "Extras" checkboxes from the create form: **Side Quest mode** and **Hinglish audio**. Side Quest was never built and is not in the roadmap, so it is dropped completely. Hinglish audio is a roadmap feature (Milestone 10) and stays. Only its checkbox goes, and the "Listen in Hinglish" card becomes available on every lesson.

**CI doesn't exist yet when this branch merges.** Before merging, run the checks by hand: `npm test` in `server`, and `npm run lint`, `npm test` and `npm run build` in `client`.

## Problem Statement

A learner who generates a course gets objectives, rich lesson content, a quiz, a module video, Hinglish audio and a PDF, but:

- No lesson suggests where to read more. The lesson prompt forbids links, so once a lesson is finished the learner has nowhere to go to deepen the topic, and has to search on their own. That is the "extensive searching" the roadmap promises to remove. The problem statement lists suggested readings or external links as a required part of every lesson.
- A lesson lists *objectives* (what the learner will be able to do) but not the *key topics* it covers, so the syllabus doesn't show at a glance which concepts live in which lesson.
- A course has no tags, so in the course list every course is just a title. The roadmap's course schema and outline prompt both include tags.
- The create form has two checkboxes that don't earn their place:
  - **Side Quest mode** promises "extra topics" but does nothing at all.
  - **Hinglish audio** only decides whether the "Listen in Hinglish" card shows up later. Audio is already made only when the learner clicks it, so the checkbox just forces a decision before the learner has seen a single lesson. A learner who left it off can never get Hinglish audio for that course.

## Solution

- Every new course's outline gives each lesson 2–5 **key topics**. They appear as small chips under the lesson title on the course syllabus and in the lesson header.
- Every new course gets 3–6 short **tags** from the outline. They appear on the course card and on the course page.
- Every newly written lesson ends with a **Further reading** section: 2–4 suggestions, each with a title, a kind (article, documentation, book, tutorial) and a link.
  - The AI never writes the URLs. It writes a search phrase, and the server turns that into a web-search link from one fixed template, so no link points at a page that doesn't exist.
  - Further reading is also in the lesson PDF.
  - It is not in the Hinglish audio and does not invalidate the audio cache.
- The create form keeps only the topic and the course depth. The **Side Quest mode** and **Hinglish audio** checkboxes are gone, and Side Quest is removed from the server too.
- The "Listen in Hinglish" card appears on **every** lesson of **every** course, including courses created with the old checkbox off. Audio is still made only when the learner clicks it, and the per-user daily limit still caps the cost.
- Courses and lessons made before this change keep working. Their key topics, tags and readings are simply empty, and the matching sections are hidden.

## User Stories

### Key topics

1. As a learner, I want each lesson on the course syllabus to show its key topics, so that I can see at a glance which concepts each lesson covers.
2. As a learner, I want the key topics in the lesson header next to the objectives, so that I know what the lesson is about before I start reading.
3. As a learner, I want the key topics to be short noun phrases (e.g. "useState", "re-rendering"), not sentences, so that they scan quickly.
4. As a learner on a phone, I want the key-topic chips to wrap onto new lines, so that the syllabus doesn't scroll sideways.
5. As a learner with a course made before this change, I want lessons without key topics to look exactly as they do today, so that nothing appears broken.
6. As a screen-reader user, I want the key topics announced as a labelled list, so that I know what the chips mean.

### Tags

7. As a learner, I want every new course to get a few tags, so that I can tell my courses apart in the list.
8. As a learner, I want the tags on each course card on the dashboard, so that I can recognise a course without opening it.
9. As a learner, I want the tags on the course page under the description, so that I can see the course's areas.
10. As a learner, I want tags to be short, lowercase and without duplicates, so that they look consistent across courses.
11. As a learner with older courses, I want courses without tags to show no empty tag row, so that the layout stays clean.

### Further reading

12. As a learner, I want a "Further reading" section at the end of each lesson, so that I know where to go deeper once I've finished it.
13. As a learner, I want 2–4 suggestions per lesson, so that I get some direction without being overwhelmed.
14. As a learner, I want each suggestion to show what kind of resource it is (article, documentation, book, tutorial), so that I can pick the one that suits me.
15. As a learner, I want each suggestion to have a short title, so that I know what I'll be looking for.
16. As a learner, I want every suggestion link to work, so that I never land on a page that doesn't exist.
17. As a learner, I want the links to open in a new tab, so that I don't lose my place in the lesson.
18. As a learner, I want the section after the quiz and the Hinglish card and before Mark as completed, so that it reads as the lesson's closing step and doesn't push the quiz down.
19. As a learner, I want the further reading in the downloaded lesson PDF, so that my offline copy also tells me where to read more.
20. As a learner using the PDF on paper, I want the search phrase printed in the PDF, so that I can type it in even though the link can't be clicked.
21. As a learner, I want the Hinglish audio to keep explaining only the lesson itself, not a list of links, so that the narration stays useful.
22. As a learner who already generated Hinglish audio for a lesson, I want that audio to keep replaying without being regenerated, so that this change doesn't cost me my daily audio limit.
23. As a learner with lessons written before this change, I want those lessons to show no Further reading section rather than an empty one, so that nothing looks broken.
24. As a learner whose lesson came back with no usable suggestions, I want the lesson to still open normally, so that one missing extra never blocks the lesson.
25. As a learner who retries a failed lesson, I want the rewritten lesson to include further reading, so that retried lessons are not second-class.
26. As a keyboard user, I want to tab through the reading links with a visible focus ring, so that I can open them without a mouse.
27. As a screen-reader user, I want each link to say it opens a web search in a new tab, so that the new tab doesn't surprise me.

### Safety of generated content

28. As the project owner, I want the AI to never write URLs, so that the app never shows made-up or unsafe links.
29. As the project owner, I want all reading links built on the server from one fixed search template with the phrase URL-encoded, so that a strange phrase can't produce a link to another site.
30. As the project owner, I want reading titles and phrases to be plain text, rendered by the existing inline-text rules (only bold and code, never HTML), so that AI output can't inject markup.
31. As the project owner, I want readings that are malformed, too long or duplicated dropped, not the whole lesson failed, so that one bad suggestion doesn't cost a Gemini call.

### Create form clean-up

32. As a learner creating a course, I want the form to ask only for the topic and the depth, so that I can start a course without deciding on features I don't understand yet.
33. As a learner, I want no "Side Quest mode" checkbox, so that I am not offered a feature that does nothing.
34. As a learner, I want "Listen in Hinglish" available on every lesson, so that I can choose Hinglish when I actually need it, not only if I ticked a box when creating the course.
35. As a learner with a course created with Hinglish audio off, I want the Hinglish card to appear on its lessons too, so that older courses get the feature as well.
36. As a learner who already generated Hinglish audio, I want it to keep replaying as before, so that removing the checkbox changes nothing for me.
37. As a learner, I want the course page subtitle to stop saying "· Hinglish audio", so that it doesn't single out some courses for a feature every course now has.
38. As the project owner, I want an older client that still sends `sideQuest` or `hinglishAudio` in the create request to keep working, so that a cached browser tab doesn't break after the change.
39. As the project owner, I want the Hinglish daily limit to stay in place, so that making audio available on every lesson doesn't raise the Gemini bill without bound.

## Implementation Decisions

### Key topics (outline)

- The outline response schema gets a required `keyTopics` string array per lesson, next to `objectives`. Every field stays `required`, as the existing generation services already do, because lite models skip optional fields.
- The outline prompt asks for 2–5 key topics per lesson, each a short noun phrase of at most 60 characters, and says they must not repeat the objectives word for word.
- `validateOutline` cleans key topics the same lenient way it cleans objectives: trims them, drops non-strings, empty and over-length values, removes case-insensitive duplicates and keeps at most 5. Missing or empty key topics **never** fail an outline (a 502 costs the user a whole generation for a cosmetic field).
- The Lesson model gets `keyTopics: [String]`, saved from the outline at course creation like `objectives`.
- The lesson prompt gets the lesson's key topics (inside its data block) and asks the lesson to cover them, so a chip never names something the lesson skips.
- The outline endpoint and the lesson endpoint both return `keyTopics` (an empty array when absent).
- The syllabus shows them as chips under each lesson title, and the lesson header shows them as chips under the objectives. When the array is empty, nothing is rendered.

### Tags (outline)

- The outline schema gets a required top-level `tags` string array. The prompt asks for 3–6 short topical tags, 1–3 words each.
- `validateOutline` normalises tags: trims, lowercases, collapses inner whitespace, drops values over 30 characters, dedupes and keeps at most 6. Zero valid tags is allowed and never fails the outline.
- The Course model gets `tags: [{ type: String, trim: true }]`, matching the roadmap's course schema.
- The course list endpoint and the outline endpoint return `tags` (empty array when absent).
- The dashboard course card shows at most 3 tags as small chips below the title, with a "+n" for the rest. The course page shows all of them under the description.
- Tags are display only: no filtering, search or editing.

### Further reading (lesson)

- The lesson response schema gets a required `readings` array. Each item has three required fields: `title` (string), `kind` (enum `article` | `documentation` | `book` | `tutorial`) and `searchQuery` (string).
- The prompt asks for 2–4 well-known, real resources that fit the lesson, each with a search phrase likely to find it. It keeps the existing rule that no URLs appear anywhere.
- Readings are stored as their own lesson field, `readings: [{ title, kind, searchQuery }]`, **not** as a content block. This keeps `LessonRenderer`, the block validator and `buildAudioSource` unchanged. The audio source hash doesn't change, so existing Hinglish audio stays cached.
- A pure `validateReadings` (in the lesson generation service, beside `validateLessonContent`) cleans the AI output:
  - trims every field
  - drops items with an empty or over-long title (> 120 characters) or search query (> 100)
  - drops any item whose title or query contains something URL-like (`www.` or `://`). A bare "http" is allowed, so real titles like "An overview of HTTP" survive
  - maps an unknown `kind` to `article`
  - removes duplicate queries and keeps at most 4.

  A lesson with zero valid readings is still **ready**. The reason for dropped items is logged, never sent to the client, as with rejected content.
- The server builds each link with a pure `readingUrl(searchQuery)`. It uses one fixed web-search template with the query URL-encoded and returns an `https` URL on that host only. The model never supplies a host, path or URL.
- The lesson endpoint returns `readings: [{ title, kind, searchQuery, url }]` for ready lessons and an empty array otherwise. `searchQuery` is sent because the PDF prints it.
- `contentVersion` is bumped to 2 for lessons written with readings. Older lessons are **not** regenerated or back-filled; they just return `readings: []`.
- **Client:** a small `FurtherReading` component in the lesson components renders a heading, then one row per reading: a kind label, the title (through `InlineText`), and a link.
  - The link has `target="_blank"`, `rel="noopener noreferrer"` and an accessible label ending "(web search, opens in a new tab)".
  - The lesson page places it after the Hinglish audio card and before Mark as completed, and renders nothing when the list is empty.
- **PDF:** `LessonPdfView` adds a "Further reading" section after the quiz. Each reading is one line with its kind, its title and "Search: <searchQuery>". It uses plain elements and complete inline styles, per the existing PDF rule. The phrase is printed because links can't be clicked in the image-based PDF.

### Removing the Side Quest and Hinglish checkboxes

- **Client form:** the "Extras" fieldset, with both checkboxes and their state, is removed from the create course form. The create request body becomes `{ topic, depth }`.
- **Create endpoint:** `POST /api/courses` reads only `topic` and `depth`. `sideQuest` and `hinglishAudio` in the body are **ignored** rather than rejected, because an older cached client may still send them. The "Invalid course options." 400 is removed.
- **Outline prompt:** the "Context only: side quest mode is …, Hinglish audio is …" line is removed. `generateCourseOutline` takes `{ topic, depth }`.
- **Course model:** `options` (`sideQuest`, `hinglishAudio`) is removed from the schema. Existing documents keep the old field in MongoDB, but nothing reads it, since Mongoose ignores fields that aren't in the schema. No migration is run.
- **Module model:** the reserved `sideQuest` field is removed. It was always `null`, so no data is lost.
- **API responses:** `options` is removed from the course list and outline responses.
- **Hinglish audio:**
  - The audio service no longer returns 409 "Hinglish audio is off for this course." Any ready lesson of a course the caller owns can request audio.
  - Everything else in Spec 6 is unchanged: generation on the "Listen in Hinglish" click, the source-hash cache, GridFS storage, `AUDIO_GEN_CONCURRENCY` and the per-user daily limit (429).
- **Lesson page:** the Hinglish audio card is always rendered in its current place, after the quiz. Further reading follows it, before Mark as completed.
- **Course page:** the subtitle drops "· Hinglish audio".
- **CLAUDE.md** is updated in this branch to match: key topics, tags and readings in Status and the generation notes; Side Quest removed everywhere; Hinglish audio described as available on every lesson; "tags" removed from anything that says it is not built.

### Unchanged

- The module video feature, the lesson queue, retry, progress and the error shapes are unchanged. A Gemini failure while writing a lesson is handled exactly as today.
- The shared course constants don't change, because the removed options were never in them.

## Testing Decisions

**What a good test is here:** it checks behaviour visible at a module's public edge. That means what an HTTP route returns for a given stored state, or what a pure validator returns for a given raw model output. It never checks how a function builds its prompt string internally (beyond the existing "prompt mentions / doesn't mention X" checks), and never checks Mongoose internals. Gemini, YouTube and `checkJwt` stay mocked as they are today.

**Seams (existing ones, highest first):**

1. **HTTP routes via supertest against the app** (prior art: the courses, lessons and audio tests).
   - Creating a course with a mocked outline that includes tags and key topics stores them and returns them from the list and outline endpoints.
   - A course stored without tags or key topics (an older course) returns empty arrays, not errors.
   - A ready lesson with stored readings returns them from the lesson endpoint, each with a `url` that starts with the fixed search host and contains the encoded query. A pending, generating or failed lesson returns `readings: []`.
   - Responses never contain a field from the server-only lists (`lastError`, `videoQuery`, `attempts`); the existing assertions are extended to the new fields.
   - **Form clean-up:**
     - Creating a course with only `{ topic, depth }` succeeds.
     - A body that still has `sideQuest` / `hinglishAudio`, even with non-boolean values, also succeeds, and neither is stored.
     - The list and outline responses no longer have `options`.
     - The old "Invalid course options." 400 cases are deleted.
   - **Hinglish audio:** a course stored with `options.hinglishAudio: false`, or with no `options` at all, can still start and play audio. The old "Hinglish audio is off" 409 case is removed. The daily-limit 429 case still passes.
2. **Pure generation validators** (prior art: the course generation and lesson generation tests).
   - `validateOutline`: tags are normalised, deduped and capped. Key topics are cleaned and capped. Missing tags or key topics never throw. The existing failure cases (module and lesson counts, titles) still throw 502.
   - The outline prompt no longer mentions side quest or Hinglish (the lesson prompt test already checks this for lessons).
   - `validateReadings`: keeps good items. Drops URL-like, empty, over-long and duplicate items. Maps an unknown kind to `article`. Caps at 4. Returns `[]` for garbage input without throwing.
   - The lesson prompt says to produce readings and still forbids URLs.
   - `readingUrl` always yields the fixed host, and encodes characters like `&`, `?`, `#`, `/` and spaces.
3. **Lesson queue** (prior art: the lesson queue test with a mocked generator): a generated lesson with readings is saved with them and `contentVersion` 2. A generator result whose readings are all invalid still ends `ready`.
4. **Audio source** (prior art: the audio source test): `buildAudioSource` output, and so the hash, is identical for a lesson with and without readings.
5. **Client:** no new client unit seam. `FurtherReading`, the chips and the slimmer create form are thin presentational changes, checked by hand in the browser: create a course, open a lesson, check the chips, the Further reading links, the Hinglish card on a course made with the old box off, and the PDF.

## Out of Scope

- **Side Quest in any form.** It is removed, not postponed. It was our own addition, not in the roadmap, and Further reading covers the "where do I go next" need it was meant for.
- Removing Hinglish audio itself, or adding other audio languages. Only the checkbox goes; the feature stays.
- Cleaning the old `options` field out of existing course documents in MongoDB.
- Filtering, searching or editing courses by tag. Editing key topics or readings.
- Back-filling key topics, tags or readings into existing courses and lessons, or a "regenerate lesson" action.
- AI-chosen or AI-written URLs, link checking, link previews or thumbnails.
- Per-lesson videos (Milestone 9's per-lesson `VideoBlock`). The per-module video stays and is explained in the README (Spec 12).
- Syntax highlighting in code blocks, a dark PDF theme, and module or whole-course PDF export.
- CI, deployment and the README rewrite (Specs 10–12).

## Further Notes

- **Optional split:** if you want smaller pull requests, this branch can be split in two without conflicts: (a) form clean-up plus tags and key topics (outline and create form), and (b) further reading (lesson generation, lesson page, PDF).
- **Why the Hinglish checkbox goes but the feature stays:**
  - Milestone 10 makes Hinglish explanations a core feature, translated "if enabled (e.g. autoTranslateToHindi flag **or user request**)". The "Listen in Hinglish" click is that user request, so a course-level flag is redundant.
  - Audio is generated only on that click, so showing the card everywhere costs nothing until a learner uses it, and the daily limit caps the rest.
- **Cost:** readings and key topics add a little to each Gemini response but no extra calls. Tags add a few tokens to the single outline call. Removing the context line slightly shortens the outline prompt.
- **Why search links and not URLs:** Gemini readily invents plausible URLs that 404 or point to the wrong page. A search phrase can't be "wrong" in that way, so the server only ever links to one known host. This is the main point to make if a judge asks why readings aren't direct links.
- **Why readings are a field, not a block:** the content blocks feed both the renderer and the Hinglish audio hash. Keeping readings out of them means existing audio stays cached and the renderer contract doesn't change.
