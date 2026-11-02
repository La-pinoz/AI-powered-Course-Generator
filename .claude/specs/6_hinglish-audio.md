# Spec 6 — Session 4: Hinglish Audio Explanation

Nov 2, 2026 · @AI User

## Purpose

Session 4 replaces the "Coming soon." placeholder in the lesson page's **Hinglish audio** bar with a real feature: a teacher-style Hinglish explanation of the lesson, made when the user asks for it, saved, and played back from storage after that.

**Product decision (already made): the audio is an explanation, not a translation and not a summary.** It is written from the lesson's own saved content, in a conversational tutor voice ("Dekho, supervised learning ka matlab hai…"), with technical terms kept in English. It must be complete enough that a student with weak English understands the concept from the audio alone, in roughly 1–3 minutes.

Pipeline (roadmap Milestone 10): saved English lesson blocks → Gemini writes a Hinglish script → Gemini TTS speaks it → the server stores the audio → the browser plays it and can download it.

This builds on Spec 5 (`5_content-creation.md`): the section registry, `lazyMount` sections, the reserved `lesson.audio` field, `geminiClient.js`, the ownership rules and the `{ message }` error shape all stay as they are.

## Decisions taken in this spec

| Question | Decision | Why |
| --- | --- | --- |
| Where is the audio stored? | **MongoDB GridFS, as MP3** (~64 kbps mono). The Hinglish script is stored on the lesson document. | No new service, account or env secret. Render's free-tier disk is wiped on every deploy or restart, so local files are out. A 3-min WAV is ~8–9 MB (≈60 lessons fill Atlas's free 512 MB); as MP3 it is ~1.4 MB (≈350 lessons). Cloud storage is a later option (see Future). |
| Download format | **`.mp3`** (the roadmap said `.wav`) | It follows from the storage decision. Converting back to WAV on download is not worth the effort. |
| Which lessons show the section? | **Only lessons of courses created with the Hinglish audio toggle on** (today's `isVisible` rule) | The toggle keeps its meaning and acts as a cost gate. |
| When is it generated? | **Only when the user clicks "Listen in Hinglish"**, never at course or lesson creation, and not just because the bar was opened | Requirement 5. This replaces Spec 5's "when the bar is first opened". |
| Show the script as text? | **Yes, as a "Show transcript" toggle under the player, closed by default** | It is already stored, so it costs nothing extra. It helps deaf and hard-of-hearing users and students who want to read along, and it makes the grounding easy to check by eye. |
| Script language/alphabet | **Roman (Latin) script Hinglish**, English terms spelled as in the lesson, no Devanagari | This is how students read and type Hinglish. It keeps technical terms in English, and Gemini TTS reads it naturally. |
| Lessons too long for one TTS call | **Chunk + stitch** at segment boundaries (see TTS) rather than trimming | Trimming would drop part of the explanation. Stitching raw PCM is trivial, and the script length is capped anyway, so it is at most 4 chunks. |
| Generate in the request or in the background? | **Background job + polling**, the same pattern as lessons | Script + TTS takes about 30–90 s, longer than a request should block. The user can leave the page and come back to finished audio. |
| What invalidates the cache? | **Only a change in the lesson's audio source text** (a hash), never a prompt, voice or model change | Lessons are never rewritten today, so this is future-proofing. Changing the prompt or voice must not silently make every user regenerate and pay again. |

## Scope

**In scope**

- Hinglish script generation (Gemini, JSON schema) from the lesson's stored blocks.
- Text-to-speech with Gemini TTS, chunking + stitching, MP3 encoding, GridFS storage.
- Three audio endpoints (status, start/retry, file) under the existing lesson routes.
- `HinglishAudioSection`: idle, generating, ready (player, download, transcript) and error states.
- Per-user daily limit, global concurrency limit, restart recovery, cleanup on course delete.
- Server tests, plus manual acceptance including listening checks.

**Out of scope**

- Per-section audio, other languages, voice picker, playback-speed persistence (see Future).
- Generating audio ahead of time for a module or course.
- Streaming audio while it is still being generated.
- Changing the lesson content format, the lesson queue, or the landing page.
- Showing the section on courses created with the toggle off, or letting users turn the toggle on later.

## User flow and UI states

The section only mounts when the user opens the bar (`lazyMount`). Mounting fetches the audio status once. Nothing is generated until the button is clicked.

| State | Shown when | What the section shows |
| --- | --- | --- |
| **Loading** | First status fetch | A small skeleton line |
| **Idle** | `status: 'none'` (never made, or outdated) | "Hear this lesson explained in simple Hinglish, like a teacher would. About 1–3 minutes." + `PillButton` **Listen in Hinglish**, plus a muted hint "The first time takes about a minute." If the audio is outdated, the text says "This lesson changed since its audio was made." and the button reads **Make new audio**. |
| **Generating** | `status: 'generating'` | `role="status"` card: "Writing the Hinglish explanation…" while `stage: 'script'`, then "Recording the audio…" while `stage: 'voice'`. Includes the note "You can keep reading; we'll keep working on it." Polls every 3 s, paused while the tab is hidden, the same as `useLesson`. |
| **Fetching audio** | `status: 'ready'`, file not loaded yet | Player chrome with a disabled play button and "Loading audio…" |
| **Ready** | File loaded | Player: play/pause button, seek slider, "1:12 / 2:45" time, speed menu (0.75× / 1× / 1.25× / 1.5×, not saved), **Download** button. Below it, the "Show transcript" toggle with the script paragraphs. |
| **Error** | `status: 'failed'`, or a request error | "We couldn't make the audio for this lesson." + the safe message from the server + **Try again** (POST again). |
| **Limit reached** | POST returned 429 | "You've reached today's limit for new Hinglish audio. Audio you already made still plays." No retry button. |

Details:

- Clicking **Listen in Hinglish** disables the button at once (no double submit) and switches to Generating as soon as the POST returns 202.
- When generation finishes, the player loads but does **not** autoplay (browsers block it anyway, and it would surprise the user). Focus moves to the play button and the live region says "Audio ready."
- Leaving the lesson mid-generation is fine. The job keeps running on the server, and reopening the bar shows the current state.
- Changing lessons stops playback, revokes the object URL and resets the section.
- Playing again, seeking or reloading the page never calls Gemini (cache rules below).
- Accessibility: every control has an accessible name ("Play Hinglish audio", "Pause", "Seek", "Download MP3"), 44 px touch targets, a visible focus ring, and Space/Enter on the play button. The slider is keyboard operable (arrows = ±5 s). The transcript is plain text.

## API

All three routes go in `routes/lessonRoutes.js` (already behind `checkJwt`, `mergeParams`, `validateObjectId`), following routes → controllers → services. Ownership uses the existing `findOwnedLesson`: another user's course, a lesson from a different course or a malformed id is always **404**, never 403. Every error body is `{ message }`.

### `GET /api/courses/:courseId/lessons/:lessonId/audio`

Status of the lesson's audio. `Cache-Control: no-store` (it is polled). Never calls Gemini, never starts a job.

```json
{
  "status": "ready",
  "stage": null,
  "durationSec": 154,
  "generatedAt": "2026-11-02T10:15:00.000Z",
  "voice": "Sulafat",
  "script": ["Namaste! Aaj hum samjhenge ki AI agent kya hota hai…", "Dekho, ek normal chatbot…"],
  "error": null
}
```

- `status`: `'none' | 'generating' | 'ready' | 'failed'`.
- `stage`: `'script' | 'voice'` while generating, otherwise `null`.
- `outdated: true` is added when saved audio exists but its source hash no longer matches the lesson. `status` is then `'none'`.
- `script` and `durationSec` only when `ready`. `error` (a safe, fixed message) only when `failed`.
- Never includes `lastError`, `fileId`, `sourceHash`, `attempts` or model names.

### `POST /api/courses/:courseId/lessons/:lessonId/audio`

Starts generation, or returns the cached result. No body. The same call is used for Retry.

| Situation | Response |
| --- | --- |
| Course has `options.hinglishAudio` off | `409 "Hinglish audio is off for this course."` |
| Lesson not `ready` | `409 "This lesson isn't ready yet."` |
| Audio `ready` and up to date | `200` with the GET body. **No Gemini call, no limit used.** |
| Audio `generating` (another click or tab) | `202 { status: 'generating', stage }`. No second job. |
| `none`, `failed`, or `ready` but outdated | Daily limit check, then an atomic claim (below) and the job is enqueued → `202 { status: 'generating', stage: 'script' }` |
| User over the daily limit | `429 "You've reached today's limit for new Hinglish audio. Try again tomorrow."` |

The claim is a single `findOneAndUpdate` with a filter "lesson is ready and `audio` is null, `failed`, or `ready` with a different `sourceHash`", setting `audio.status: 'generating'`, `audio.stage: 'script'`, `audio.startedAt`, and `$inc audio.attempts`. If nothing matched, re-read the lesson and answer from its current state. Two quick clicks or two tabs can therefore never start two jobs.

### `GET /api/courses/:courseId/lessons/:lessonId/audio/file`

Streams the MP3 from GridFS.

- `404 "Audio not found."` unless the audio is `ready` and up to date. The GridFS id always comes from the lesson document, **never** from the client.
- Headers: `Content-Type: audio/mpeg`, `Content-Length`, `Cache-Control: private, no-cache`, `ETag` = the file id; a matching `If-None-Match` gets `304`. (Changed from `max-age=86400`: regenerated audio keeps the same URL, so a day-long browser cache could play the old file.)
- `?download=1` adds `Content-Disposition: attachment; filename="<course-slug>-m<module>-l<lesson>-hinglish.mp3"`. Otherwise it is `inline`.
- No Range support needed: the client fetches the whole file as a blob (next point), and seeking works on the blob URL.

**Why the client fetches a blob.** `<audio src>` cannot send the `Authorization: Bearer` header, and putting the token in a query string would leak it into logs. `useLessonAudio` therefore fetches the file with `getAccessTokenSilently()`, makes `URL.createObjectURL(blob)` for the player and the download link (`<a download>`), and revokes it on unmount or lesson change. `utils/api.js` currently always parses JSON, so add a small `apiRequestBlob` (or a `responseType: 'blob'` option) next to it, with the same error mapping.

### Existing endpoints

- `GET …/lessons/:lessonId`: unchanged; it still does not send `audio`. The section asks for audio status itself, only when it is opened.
- `DELETE /api/courses/:id`: also deletes the course's GridFS audio files (metadata `courseId`) and cancels queued audio jobs for the course.

## Pipeline

One job per lesson, run by a small in-memory runner (`services/audioJobs.js`): at most `AUDIO_GEN_CONCURRENCY` jobs at once (default **1**, because TTS rate limits are low), FIFO otherwise. It is single-process only, like the lesson queue and the 409 lock.

```
claim (POST) → [stage: script] build source → Gemini script → validate
            → [stage: voice]  chunk → Gemini TTS per chunk → validate durations → stitch PCM → encode MP3
            → write GridFS → updateOne(status 'generating' → 'ready') → delete the previous file (if any)
any failure → status 'failed', lastError (server-only), safe message
```

Before saving, check that the lesson still exists and is still `generating` with the same `startedAt`. If it isn't, delete the new GridFS file and drop the result. The whole job has a deadline of `AUDIO_TOTAL_TIMEOUT_MS` (default 300 s).

### Step 0: Build the audio source (`buildAudioSource(lesson)`)

This is a pure function, and its output is both the prompt input and what gets hashed for the cache.

| Block | Goes into the source as | Notes |
| --- | --- | --- |
| `heading` | `SECTION: <text>` | Explained |
| `paragraph` | the text | Explained |
| `list` | one `- item` per line | Explained |
| `example` | `EXAMPLE: <title> — <text>` | Explained; the script should walk through it |
| `callout` | `TIP:` / `NOTE:` / `WARNING:` + text | Explained |
| `code` | `CODE (<language>, do not read aloud): <first 800 chars>` | The script gives 1–2 sentences on **what the code does**, never reads syntax |
| `mcq` | **left out entirely** | Questions, options, answers and explanations never reach the prompt, so they cannot leak |
| unknown types | left out | Matches the renderer's "skip unknown" rule |

There is no `video` block in this app (the video phrase is `lesson.videoQuery`, which is also left out).

The source also gets the lesson title, objectives and `summary` as a header. `**bold**` and `` `code` `` markers are removed from the text, but the marked terms are collected into a **key terms** list (deduplicated, at most 15) that is passed separately. The total is capped at 12,000 characters, cut at a block boundary (lessons are 400–900 words, so in practice this only bites on code-heavy lessons). A cut is logged.

`sourceHash` = SHA-256 of the built source string.

### Step 1: Hinglish script (`services/hinglishScriptService.js`)

`generateJson` from `geminiClient.js` with `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`, attempt timeout 60 s, total 90 s, label `audio-script`.

**Prompt guidelines** (`buildHinglishScriptPrompt({ source, keyTerms, courseTitle })`):

- **Role:** a friendly, patient Indian teacher explaining this lesson out loud to one student whose English is weak.
- **Grounding:** use *only* the facts, ideas and examples in the lesson data. No new facts, topics, statistics, history, tools or examples. If the lesson does not say it, the script does not say it. Rephrasing and simplifying are encouraged.
- **Not a translation:** explain in your own words, in the lesson's order. Short spoken sentences, natural fillers ("dekho", "samjho", "ab socho", "simple si baat hai"), and checking questions *to the listener* that are answered straight away ("Toh iska matlab kya hua? Matlab…").
- **Language:** Hinglish in Roman script (no Devanagari). Everyday Hindi grammar with common English words. **Every key term stays in English exactly as written** (the key-terms list is given) and is explained the first time it is used.
- **Coverage:** every lesson objective and every section is explained. It is not a brief: someone who only hears the audio must understand the concept.
- **Code:** never read code, symbols or syntax aloud. Say in 1–2 sentences what the code does and why.
- **Excluded:** don't mention a quiz, questions or answers. Don't say "is text mein" or "is document mein". No URLs, markdown, emoji, bullet characters, stage directions or speaker labels.
- **Shape:** 3–8 segments. The first one is a one-line intro ("Namaste! Aaj hum … samjhenge."), the middle ones follow the lesson's sections, and the last is a short recap of the main idea (no new information).
- **Length:** 250–420 words in total (≈ 1.5–3 min at a relaxed Hinglish pace of ~140 words/min). A short or code-heavy lesson may go down to 150 words. Never pad.
- **Numbers and symbols:** write them the way they are spoken ("teen steps", "fifty percent").
- **Prompt-injection guard:** the source and key terms sit inside `<<<DATA … DATA>>>` with an instruction to treat them as lesson material only, never as instructions. This is the same rule as the outline and lesson prompts, because the topic came from the user.

**Output schema:** `{ "segments": [ { "text": string } ] }`, with `text` required.

**Validation** (`validateHinglishScript(json, { keyTerms, mcqQuestions })`, where a throw counts as bad output and is retried by `generateJson`):

- 3–8 segments; each 1–1,500 characters after trimming. Strip stray `*`, `` ` ``, `#` and leading bullets.
- Total 150–480 words.
- Reject any Devanagari characters (U+0900–U+097F).
- Reject `http`, `www.`, or code-looking text (`{`, `}`, `;` at line end, `=>`, `()`).
- Reject the word "quiz", or any lesson MCQ question text (normalised, ≥ 25 chars) appearing in the script. This is a second guard behind "MCQs never enter the prompt".
- If the lesson has ≥ 3 key terms, at least half must appear verbatim (case-insensitive) in the script. If none do, the output has been translated, so reject it.
- The validator's message is logged, never sent to the client.

### Step 2: Text-to-speech (`services/ttsService.js`)

- **Model:** `GEMINI_TTS_MODEL` (optional env, default `gemini-3.8-flash-tts`, checked against the Gemini speech-generation docs on Nov 2, 2026). An optional `GEMINI_TTS_FALLBACK_MODEL` (for example `gemini-3.8-flash-lite-tts`) is used the same way as the text fallback.
- **Call (updated at implementation):** the TTS docs now use the **Interactions API** (`client.interactions.create`, `@google/genai` ≥ 2.24), not `models.generateContent`. The input is one `user_input` text part. The voice goes in `generation_config.speech_config: [{ voice }]`, and `response_format: { type: 'audio', mime_type: 'audio/l16', sample_rate: 24000 }` asks for raw PCM (a unary call would otherwise return WAV). `output_audio.data` is base64 PCM: signed 16-bit little-endian, **24 kHz, mono**. The sample rate is read from the response, and a RIFF header is stripped if one comes back anyway.
- **Voice:** `GEMINI_TTS_VOICE`, default **`Sulafat`** (warm). Before shipping, do a short listening test of Sulafat, Achird (friendly) and Charon (informative) on one real Hinglish script, and record the winner in `.env.example`. The voice name is saved on the audio record.
- **Style instruction (updated at implementation):** sent as a `speech_metadata` annotation on the text part (`style`), **not** as a prefix in the text. The docs say the text is read strictly verbatim, so a prefix would be spoken aloud. The style is: *"Hinglish, like a warm, patient Indian teacher explaining to one student. Conversational, moderate pace, short natural pauses between sentences. English technical terms pronounced clearly in an Indian English accent."*
- **Chunking + stitching:** group consecutive segments into chunks of ≤ 1,800 characters, never splitting a segment (a segment over 1,800 characters is split at a sentence end). A typical script (~2,000–2,600 characters) makes 2 chunks, and the validated maximum makes at most 4. Chunks run **one after another**, with the same voice and style. Join the PCM buffers with 400 ms of silence between chunks. Sequential calls keep within rate limits and the voice consistent.
- **Per-chunk retries:** each chunk gets up to 2 attempts, 90 s each, across the TTS model list, using the same `config` / `busy` classification as `geminiClient.js`. Factor out a shared helper; do not copy the logic. **Do not** pass the JSON `responseSchema` options to TTS calls.
- **Duration check per chunk** (catches truncated or runaway audio): expected = words ÷ 2.3 words/s. Reject (and retry that chunk) if the actual length is under 0.5× or over 2.0× that.
- **Final checks:** total duration 30–300 s, otherwise fail the job. The target for a typical lesson is **60–200 s**.
- **Encoding (`utils/audioEncoding.js`):** PCM → MP3, 64 kbps CBR, mono, 24 kHz (a valid MPEG-2 Layer III rate), using `@breezystack/lamejs` 1.2.7 (pure JS, no dependencies, `npm audit` clean). The encode runs in a **worker thread** (`utils/mp3Worker.js`), because it takes about 2 s of CPU for 150 s of audio and would otherwise block every API request meanwhile. `durationSec` = samples ÷ sample rate, rounded.

### Storage (GridFS)

- Bucket `lessonAudio` via `new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'lessonAudio' })`. No new dependency.
- Filename `<lessonId>.mp3`. Metadata `{ lessonId, courseId, creator, sourceHash }`. Add an index on `metadata.courseId` for the cascade delete.
- A new file is written **before** the lesson is updated. The old file is deleted only after the update succeeds, so a failed regeneration never loses working audio.

## Data model changes

**Lesson.audio** changes from the reserved `Mixed` placeholder (`{status, url, durationSec, generatedAt}`) to a sub-schema. It still defaults to `null`, so existing lessons need no migration. `url` is dropped, because the URL is always derived from the route.

| Field | Type | Sent to client |
| --- | --- | --- |
| `status` | `'generating' \| 'ready' \| 'failed'` (`null` audio = `'none'`) | yes |
| `stage` | `'script' \| 'voice' \| null` | yes |
| `language` | `'hinglish'` (fixed for now; leaves room for more languages) | no |
| `script` | `[String]`, the validated segments | yes, when ready |
| `fileId` | ObjectId (GridFS) | **no** |
| `mimeType` | `'audio/mpeg'` | no |
| `bytes` | Number | no |
| `durationSec` | Number | yes, when ready |
| `voice` | String | yes |
| `scriptModel`, `ttsModel` | String (the models that actually succeeded) | no |
| `pipelineVersion` | Number, `1` (prompt/pipeline format, informational only) | no |
| `sourceHash` | String, SHA-256 of `buildAudioSource(lesson)` | no |
| `startedAt`, `generatedAt` | Date | `generatedAt` only |
| `attempts` | Number (user-started jobs) | no |
| `errorKind` | `'busy' \| 'failed' \| 'timeout' \| 'empty' \| 'interrupted'`, picks the safe message | no (the message is) |
| `lastError` | String, server-only | **never** |

Keep the existing `lessonService.getLesson` rule of never including `audio`.

### Cache rule

- **Valid** = `audio.status === 'ready'` and `audio.sourceHash === hash(buildAudioSource(lesson))`. Plays, reloads, new tabs and downloads all read GridFS. Gemini is not called.
- **Invalidated only when the source text changes.** Because `buildAudioSource` leaves out MCQs and `videoQuery`, changes to those do not invalidate the audio. Lessons are never rewritten today, so in practice this triggers only if a future feature (for example a lesson regenerate) changes the content.
- Outdated audio is reported as `status: 'none', outdated: true`, and the file endpoint returns 404 for it, so an outdated explanation is never played. The old file is deleted when the new one is saved, or by the course cascade.
- Changing the prompt, `pipelineVersion`, voice or model does **not** invalidate existing audio. A future forced refresh would be a deliberate migration.

## Limits and edge cases

| Case | Handling |
| --- | --- |
| **Very long lesson** | The source is capped at 12,000 characters, cut at a block boundary (logged). The script is capped at 480 words, so audio never goes much past ~3.5 min, whatever the lesson length. |
| **TTS input / duration limits** | Chunks of ≤ 1,800 characters stay well inside the TTS input limit. At most 4 chunks. The per-chunk duration check catches truncation. Total duration 30–300 s is enforced. |
| **Mostly-code lesson** | Code bodies are limited to 800 characters each in the source and are explained, not read. The minimum script length drops to 150 words, so short honest audio is accepted rather than padded. |
| **Empty or not-ready lesson** | POST → `409 "This lesson isn't ready yet."` The section is only reachable on a ready lesson anyway. A ready lesson whose source has no explainable text (only MCQs) → job fails with "This lesson has nothing to explain in audio." (no Gemini call). |
| **Concurrent clicks / two tabs** | The atomic claim allows only one job. Other callers get `202 generating` and poll. The button is disabled while the POST is in flight. |
| **Gemini busy / rate-limited (429, 5xx, network)** | Retried inside each step. If attempts run out → `failed`, safe message "The audio service is busy right now. Please try again in a minute." |
| **Bad script or bad audio** | Retried. If attempts run out → `failed`, "We couldn't make the audio this time. Please try again." |
| **Wrong key / model name (400/401/403/404)** | That model is not retried, and the job fails with the generic failed message. The real reason is only logged. |
| **Job deadline (300 s)** | `failed`, "Making the audio took too long. Please try again." |
| **Server restart / Render sleep mid-job** | `recoverStaleLessons()` at boot (and the GET status per lesson) turns `audio.status: 'generating'` with `startedAt` older than `AUDIO_TOTAL_TIMEOUT_MS + 60 s` into `failed` ("interrupted", safe message as for busy). Nothing is auto-restarted; the user's Try again does it. Any orphan GridFS file from the interrupted job is removed by a boot sweep (files whose `lessonId` lesson has a different or no `fileId`). |
| **Course deleted mid-job** | `deleteCourse` cancels queued jobs. The running job's save check finds no lesson and deletes its own file. The cascade deletes all files with that `courseId`. |
| **Quota / cost control** | (1) Only on click, only for Hinglish-on courses. (2) Cached forever unless the source changes. (3) `AUDIO_DAILY_LIMIT_PER_USER` (default 10) **new jobs started** per user per UTC day, counted in memory (resets on restart, the same single-process caveat as the 409 lock); cached plays never count. (4) `AUDIO_GEN_CONCURRENCY` (default 1) global. (5) Each job makes at most 1 script call (3 attempts) + 4 TTS chunks (2 attempts each). Log one line per job with models, chunk count, duration and elapsed time, for cost tracking. |
| **Storage growth** | ~1.4 MB per 3 min. Logged per job. The cascade delete and replace-then-delete keep exactly one file per lesson. |
| **Playback errors in the browser** | If the blob fails to load or decode, show the error state with "Try again" (refetch the file only, not regenerate). |

## Security

- The Gemini key stays in `server/.env`. The browser only talks to `/api/…`, and the TTS and script calls happen only on the server.
- All three endpoints are behind `checkJwt` plus the ownership check; a foreign or missing id is 404. The file endpoint is checked the same way, so one user can never fetch another user's audio.
- GridFS ids are never accepted from, or sent to, the client.
- `lastError`, raw upstream messages, model names and validator reasons are logged only. The client gets fixed messages.
- The transcript is rendered as plain text (no `InlineText`, never HTML), because it is AI output.
- The access token is never put in a URL (blob fetch instead of `<audio src>`).
- Prompt-injection guard as described in Step 1. The limits above also cap how much Gemini spend one account can cause.

## Code layout

**Server**

- `services/audioService.js`: ownership, status shape, claim, limit check, cache rule; called by the controller.
- `services/audioJobs.js`: in-memory runner (enqueue, concurrency, `cancelCourse`, deadline).
- `services/audioSource.js`: `buildAudioSource`, `extractKeyTerms`, `hashSource` (pure, easy to test).
- `services/hinglishScriptService.js`: prompt, schema, `validateHinglishScript`.
- `services/ttsService.js`: chunking, TTS calls, duration checks, stitching.
- `services/audioStorage.js`: GridFS write, stream, delete, sweep.
- `utils/audioEncoding.js`: PCM → MP3, duration.
- `controllers/audioController.js`, routes added to `routes/lessonRoutes.js`.
- `geminiClient.js`: the retry/classify loop is shared with a new `generateSpeech` export. Outline and lesson behaviour is unchanged.
- `config/env.js` + `.env.example`, all optional: `GEMINI_TTS_MODEL`, `GEMINI_TTS_FALLBACK_MODEL`, `GEMINI_TTS_VOICE`, `AUDIO_GEN_CONCURRENCY` (1), `AUDIO_DAILY_LIMIT_PER_USER` (10), `AUDIO_TOTAL_TIMEOUT_MS` (300000). The required list stays at seven.

**Client**

- `components/lesson/HinglishAudioSection.jsx` replaces `ComingSoonSection` in the `hinglish-audio` registry entry (the title, subtitle and `isVisible` stay).
- `components/lesson/audio/AudioPlayer.jsx` (Chakra `Slider`, inline SVG play/pause/download icons added to `icons.jsx`, palette tokens only) and `Transcript.jsx`.
- `hooks/useLessonAudio.js(courseId, lessonId)` → `{ status, stage, outdated, durationSec, script, objectUrl, error, start, retry, reloadFile }`: polls while generating (3 s, paused when hidden), aborts on lesson change, fetches the blob when ready, revokes the URL on cleanup.
- `utils/api.js`: blob request helper.
- No new client dependencies.

Update `CLAUDE.md` (status, endpoints, the GridFS bucket, the new env vars, the single-process limit for the runner and the daily counter) when this lands.

## Testing and acceptance

### Server tests (Vitest + supertest + mongodb-memory-server; the script and TTS services mocked at the Gemini boundary)

- `buildAudioSource`: includes heading/paragraph/list/example/callout text; **contains no MCQ question, option, answer or explanation text**; replaces code bodies with the `CODE … do not read aloud` marker capped at 800 chars; leaves out `videoQuery` and unknown types; respects the 12,000-char cap at a block boundary; is deterministic (same lesson → same hash; MCQ-only change → same hash; paragraph change → different hash).
- `buildHinglishScriptPrompt`: the source and key terms appear only inside the data block; the key terms are listed; the rules mention keeping terms in English and not reading code.
- `validateHinglishScript`: accepts a good script; rejects too few or too many segments, < 150 or > 480 words, Devanagari, a URL, code-looking text, "quiz", an MCQ question, and a translated script with no key terms; strips markdown characters.
- TTS: segments are grouped into ≤ 1,800-char chunks without splitting a segment; chunks run in order; PCM is stitched with 400 ms of silence; a truncated chunk (< 0.5× expected) is retried; a config error is not retried on that model; the total-duration bounds are enforced.
- Encoding: a known PCM buffer gives a valid MP3 (frame sync header) and the right `durationSec`.
- `POST …/audio`:
  - First call → 202 and a job starts.
  - **When ready, a second POST and any number of `GET …/audio/file` calls do not call the script or TTS mocks again** (call counts stay at 1).
  - Two parallel POSTs start exactly one job.
  - 409 when the lesson is not ready or the course has Hinglish off.
  - 429 after the daily limit, while cached audio still returns 200.
  - 404 for another user's course, a lesson from another course, and a malformed id.
- `GET …/audio`: correct `status` and `stage` through the job; `outdated` after the lesson content changes; never leaks `lastError`, `fileId`, `sourceHash` or model names.
- `GET …/audio/file`: `audio/mpeg` with the right length; `?download=1` sets the attachment filename; 404 when not ready, when outdated, and for a foreign lesson.
- Failures: a busy script step → `failed` with the busy message; the old ready file survives a failed regeneration; the job deadline marks `failed`.
- Recovery and cleanup: a stale `generating` audio becomes `failed` at boot; deleting a course removes its GridFS files and cancels its jobs; a job finishing for a deleted lesson leaves no file behind.

### Manual acceptance (on a fresh Hinglish-on course and one technical lesson)

- [ ] The Hinglish audio bar appears only on courses created with the toggle on. Opening it makes **no** generation request (Network tab: only `GET …/audio`).
- [ ] Clicking **Listen in Hinglish** shows "Writing…" then "Recording…", and the player appears within about 90 s.
- [ ] Play/pause, seek, speed and **Download** work; the downloaded `.mp3` plays in a normal media player.
- [ ] **Length:** on a typical lesson (400–900 words) the audio is 1–3 minutes (`durationSec` 60–200).
- [ ] **No MCQ leakage:** listening while reading the transcript, no quiz question, option or answer is spoken and the word "quiz" never comes up.
- [ ] **Technical terms stay in English:** every bolded term in the lesson that the script uses is said in English (spot-check 5 terms).
- [ ] **Grounded:** the transcript has no fact, example or tool that is not in the lesson (check against the Explanation section).
- [ ] **Tone:** it sounds like a tutor explaining ("dekho…", questions to the listener), not a line-by-line translation and not a 20-second summary. Someone who reads little English can follow the main idea.
- [ ] **Code lesson:** code is described ("yeh code ek list banata hai…"), never read symbol by symbol.
- [ ] **Second play doesn't call Gemini:** reload the page and play again; the server log shows no `audio-script` / TTS lines and the Network tab shows only `GET …/audio` + `GET …/audio/file`.
- [ ] Double-clicking the button or clicking in two tabs starts one job (one set of log lines).
- [ ] Leaving the lesson mid-generation and coming back shows the progress or the finished player.
- [ ] Forcing a failure (a wrong `GEMINI_TTS_MODEL`) shows the error state; fixing it and clicking **Try again** recovers.
- [ ] The daily limit message appears after the limit; existing audio still plays.
- [ ] Deleting the course removes its files from the `lessonAudio.files` collection.
- [ ] Keyboard only and screen reader: every control is reachable and named; "Audio ready" is announced; at mobile width the controls are ≥ 44 px and nothing overflows.
- [ ] The landing page and the other lesson sections are unchanged.

## Future (not in this session)

- **Per-section audio:** a small speaker button on each `heading` section, using the same pipeline with the source limited to that section. The `audio` record would become a list keyed by `{ language, scope }`.
- **More languages:** pure Hindi (Devanagari script), Tamil, Bengali and others. `audio.language` is already stored. Add a language picker, a per-language prompt (the "keep terms in English" rule stays), and store one record per language.
- **Voice selection** from a short curated list, saved per user; the voice is already recorded per audio.
- **Two-voice "teacher and student" mode** with Gemini multi-speaker TTS.
- **Cloud object storage** (S3 / Cloudinary with signed URLs) if GridFS space gets tight; only `audioStorage.js` changes.
- **Pre-generating** a module's audio in the background once the user plays the first lesson's audio.
- **Including the transcript** in the Session 5 course PDF as an appendix.
- **Persisted daily limits** in MongoDB once the server runs more than one instance.
