# SPEC: Fix Course Generation ("Generate course" fails)

Nov 1, 2026 · @AI User

## 1. Problem

Clicking **Generate course** on `/dashboard` ends in the red error alert instead of redirecting to the new course. It shows one of two messages:

- "Error generating course: The AI couldn't generate this course. Please try again." (fast, within a few seconds), or
- "Error generating course: Course generation timed out. Please try again." (after about 90 seconds).

### 1.1 Root cause (verified Nov 1, 2026)

It is not a client, auth, validation or database bug. The request reaches `POST /api/courses`, passes validation, and fails inside `generateCourseOutline` (`server/services/courseGenerationService.js`) because **the configured Gemini model is overloaded**.

`server/.env` has `GEMINI_MODEL=gemini-3.8-flash`. Calls made directly with the app's own key and SDK gave these results:

| Call | Result |
| --- | --- |
| `generateCourseOutline` (real prompt), `gemini-3.8-flash` | Failed after 3.9 s: Gemini `503 UNAVAILABLE`, "This model is currently experiencing high demand…" → app returns **502** "The AI couldn't generate this course." |
| `"Say ok"`, `gemini-3.8-flash` ×3 | Succeeded, but took **120 s, 107 s and 165 s**. A real outline prompt is larger, so it goes past the app's 90 s limit → **504** "Course generation timed out." |
| `"Say ok"`, `gemini-2.5-flash` / `gemini-2.5-flash-lite` | `404`: "no longer available to new users" (so the `.env.example` hint `gemini-2.5-flash` is stale) |
| `"Say ok"`, `gemini-3.5-flash-lite` | OK in 1.7 s |
| `"Say ok"`, `gemini-3.5-flash` | OK in 4.2 s |
| `generateCourseOutline` (real prompt, `standard` depth), `gemini-3.5-flash-lite` | **OK in 3.4 s**, 4 modules, passed `validateOutline` |

So the failure path is: Gemini 503 or very slow response, then the service makes **one attempt with one model and no retry**, then 502 or 504, then the client alert. The existing error handling behaves as specified in SPEC 3 (Section 7.5); the design just has no resilience against a provider that is overloaded or slow.

Two smaller problems make this hard to diagnose:

1. The user sees the same generic 502 text for "Gemini is overloaded, try in a minute", "the model name is wrong / retired" and "the model returned bad JSON". Only the server console says which.
2. The server log line (`[generation] Gemini call failed: …`) has no model name, attempt number, upstream status or duration.

### 1.2 Immediate workaround (no code change)

In `server/.env` (which the implementer must **not** edit; the developer does it), set:

```
GEMINI_MODEL=gemini-3.5-flash-lite
```

and restart the server. Verified above to generate a valid outline in ~3 s. `gemini-3.5-flash` also works (~4 s for a trivial prompt) if better quality is wanted.

The code changes below make generation survive a busy or slow model, so this doesn't happen again the next time a model is overloaded.

## 2. Objective & Bounded Scope

### 2.1 In scope (server only)

- Retry transient Gemini failures and fall back to a second model, all within the existing 90 s budget.
- Give each attempt its own timeout so one slow model can't use up the whole budget.
- Distinguish "AI service busy" from "AI output was invalid" in the response to the user.
- Better server logging per attempt.
- Update `.env.example`, `config/env.js`, tests, `CLAUDE.md`.

### 2.2 Non-goals

- Do **NOT** change the client form, its states, `GenerateStatus.jsx` or `api.js`. The client already shows any `{ message }` from a 5xx/4xx and has a Try again button. (The cosmetic hints in `GenerateStatus.jsx` stay as they are.)
- Do **NOT** add streaming, background jobs, queues or polling. Generation stays one synchronous `POST`.
- Do **NOT** change the prompt, `responseSchema`, `validateOutline` rules, depth/lesson limits, or persistence.
- Do **NOT** edit `server/.env`.
- Do **NOT** add another LLM provider or SDK.

## 3. Existing Code

| File | Today | After this spec |
| --- | --- | --- |
| `server/services/courseGenerationService.js` | One `generateContent` call, one model, 90 s timeout (504), any failure → 502 | Attempt loop across a model list with per-attempt timeouts and a 90 s overall deadline (Section 4) |
| `server/config/env.js` | 7 required vars | Same 7 required, plus optional `GEMINI_FALLBACK_MODEL` (Section 5) |
| `server/.env.example` | Suggests `gemini-2.5-flash` (retired) | Suggests `gemini-3.5-flash-lite`; documents `GEMINI_FALLBACK_MODEL` |
| `server/middlewares/errorHandler.js` | Exposes message for `<500`, `502`, `504` | Also exposes `503` (Section 4.4) |
| `server/tests/courseGeneration.test.js` | Covers the single-attempt behaviour | Updated + new cases (Section 7) |

## 4. Generation Service Changes (`services/courseGenerationService.js`)

### 4.1 Models tried

`models = [config.geminiModel, config.geminiFallbackModel]` with empty values and duplicates removed. If no fallback is configured, the list is just the primary model.

### 4.2 Attempt plan and timing

- **Overall deadline: 90 s** from the start of `generateCourseOutline` (unchanged `GENERATION_TIMEOUT_MS`). Nothing may run past it.
- **Per-attempt timeout: 40 s** (`ATTEMPT_TIMEOUT_MS`), capped at the time left before the deadline. Each attempt gets its own `AbortController`; the controller is aborted when the attempt times out, and a pending attempt is also aborted when the overall deadline hits.
- **Max attempts: 3** in total. Order: primary model; then the fallback model if configured, otherwise the primary again; then the next model in rotation (primary → fallback → primary, or primary ×3 with no fallback).
- **Backoff** before a retry on the **same** model: 1 s then 2 s (plus up to 250 ms random jitter). No wait before switching to a **different** model.
- Don't start an attempt if less than **5 s** is left before the deadline; stop and report the last error instead.

### 4.3 What gets retried

Classify each failed attempt:

| Failure | Classification | Retry? |
| --- | --- | --- |
| SDK error with status `429`, `500`, `503`, `504`, or a network error (no status, e.g. `fetch failed`, `ECONNRESET`) | `busy` | Yes |
| Per-attempt timeout | `busy` | Yes |
| `response.text` not parseable JSON, or `validateOutline` throws | `bad-output` | Yes (the model often gets it right on the next try) |
| SDK error with status `400`, `401`, `403`, `404` | `config` | **No retry on that model.** If a different model is left, try it; otherwise stop |

A `config` failure means the key or model name is wrong (e.g. the retired `gemini-2.5-flash` gives `404`). Log it at `error` level with the model name and upstream message so the developer sees it at once.

`validateOutline` stays a pure function, exported and unchanged in behaviour. The attempt loop catches its 502 and treats it as `bad-output`.

### 4.4 Final error when every attempt fails

Based on the **last** attempt's classification, unless noted:

| Situation | Status | `message` |
| --- | --- | --- |
| Overall 90 s deadline reached | `504` | "Course generation timed out. Please try again." (unchanged) |
| Last failure `busy` (overload, rate limit, per-attempt timeout, network) | `503` | "The AI service is busy right now. Please try again in a minute." |
| Last failure `bad-output` | `502` | "The AI couldn't generate this course. Please try again." (unchanged) |
| All attempted models failed with `config` | `502` | "The AI couldn't generate this course. Please try again." (no key/model details sent to the client) |

Never send the raw upstream message to the client (the existing test "maps a Gemini-side 504 to our 502, not the raw upstream message" keeps that intent: the client gets our wording, never Gemini's).

`errorHandler.js`: add `503` to the exposed statuses (`502`, `503`, `504`), so the "busy" message reaches the user. Other 5xx stay generic.

`503` is safe for the in-memory lock: `createCourse` still removes the `sub` in `finally` whatever the outcome.

### 4.5 Logging

One line per failed attempt and one on success, without the topic text or API key:

```
[generation] attempt 1/3 model=gemini-3.8-flash failed busy (503 UNAVAILABLE) after 3861ms
[generation] attempt 2/3 model=gemini-3.5-flash-lite ok after 3408ms
```

Use `console.warn` for failed attempts that will be retried, `console.error` for the final failure and for any `config` failure, and `console.info` for success when it took more than one attempt.

## 5. Configuration

- `config/env.js`: add optional `geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL?.trim() || null` to the frozen config. **Not** added to `REQUIRED`.
- `server/.env.example`:

```
GEMINI_MODEL=Gemini model name used for course generation, e.g. gemini-3.5-flash-lite
GEMINI_FALLBACK_MODEL=Optional. Second model tried when the first is busy or slow, e.g. gemini-3.5-flash
```

- `vitest.config.js`: leave `GEMINI_FALLBACK_MODEL` unset by default; tests that need it set it (or mock `config`) explicitly.
- Tell the developer to update `server/.env` (Section 1.2) and optionally add `GEMINI_FALLBACK_MODEL=gemini-3.5-flash`. Don't edit it for them.

## 6. Docs

- `CLAUDE.md`, server bullet on generation: replace "one Gemini call with a JSON schema, 90s timeout (504), anything else that fails or doesn't validate is a 502" with the new behaviour: up to 3 attempts across `GEMINI_MODEL` / optional `GEMINI_FALLBACK_MODEL`, 40 s per attempt, 90 s overall (504), busy → 503, bad output → 502. Mention `GEMINI_FALLBACK_MODEL` as optional next to the seven required vars, and that `errorHandler` also exposes 503.
- `README.md` env table (if it lists the Gemini vars): add `GEMINI_FALLBACK_MODEL`, fix the example model name.
- SPEC 3's `POST /api/courses` status table is superseded by Section 4.4 here; no need to edit SPEC 3.

## 7. Tests (`server/tests/courseGeneration.test.js`, `server/tests/courses.test.js`)

Mock `generateContent` as today and use fake timers for timing cases. Update existing cases whose expectations change (e.g. "maps SDK errors and bad JSON to 502" now involves retries: each case must mock enough rejections, or assert on the final outcome after all attempts).

Add:

1. **Recovers from a transient 503:** first call rejects `{ status: 503 }`, second resolves a valid outline, so the result is the outline; `generateContent` called twice.
2. **Falls back to the second model:** with `GEMINI_FALLBACK_MODEL` set, first call (primary) rejects 503, second call is made with `model === fallback` and succeeds.
3. **No fallback configured:** retries stay on the primary model (assert `call.model` for each call).
4. **All attempts busy → 503** with "The AI service is busy right now. Please try again in a minute."; exactly 3 calls.
5. **Bad output then good:** first returns `'not json'`, second valid, so success.
6. **All attempts bad output → 502** with the existing message.
7. **Config error is not retried on the same model:** primary rejects `{ status: 404 }` with no fallback, so exactly 1 call and 502. With a fallback, the second call uses the fallback.
8. **Per-attempt timeout:** first call never settles; after 40 s its `abortSignal` is aborted and a second attempt starts; the second succeeds.
9. **Overall deadline:** every call never settles, so the promise rejects with **504** at 90 s, not later; every issued `abortSignal` is aborted; no attempt starts with <5 s left.
10. **Upstream message never leaks:** a rejection with a distinctive upstream message leads to a final error message that is one of our three strings.
11. `courses.test.js`: `POST /api/courses` with the service mocked to throw `{ status: 503, message: 'The AI service is busy…' }` gives `503` with that `message` (checks the `errorHandler` change), and the user can immediately POST again (lock released).

`npm test` passes; `npm run lint` in `client/` is unaffected (no client changes).

## 8. Acceptance Criteria

- [ ] With `GEMINI_MODEL=gemini-3.5-flash-lite` in `.env`, clicking **Generate course** for "Intro to Python" / Standard redirects to `/courses/:id` within a few seconds and the course appears in the sidebar and Continue Learning.
- [ ] With `GEMINI_MODEL=gemini-3.8-flash` (overloaded) and `GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite`, generation succeeds through the fallback, and the server log shows the failed primary attempt and the successful fallback attempt.
- [ ] With an overloaded primary and no fallback, the user sees either success after a retry or "The AI service is busy right now. Please try again in a minute." within 90 s, never a hang longer than 90 s.
- [ ] With a retired/invalid model name (e.g. `gemini-2.5-flash`) and no fallback, the request fails fast (one call, under a few seconds), the client gets the generic 502 text, and the server log names the model and the upstream 404.
- [ ] No response body ever contains Gemini's raw error text, the API key, or the topic in logs.
- [ ] Try again after any failure works (the per-user 409 lock is released).
- [ ] All server tests pass.
