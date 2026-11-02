import 'dotenv/config';

const REQUIRED = [
  'PORT',
  'MONGODB_URI',
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_AUDIENCE',
  'CLIENT_ORIGIN',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
];

const missing = REQUIRED.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(
    `[config] Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Set them in server/.env (see server/.env.example).',
  );
  process.exit(1);
}

// Optional positive-integer setting with a default.
const positiveInt = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const config = Object.freeze({
  port: Number(process.env.PORT),
  mongodbUri: process.env.MONGODB_URI,
  auth0IssuerBaseUrl: process.env.AUTH0_ISSUER_BASE_URL,
  auth0Audience: process.env.AUTH0_AUDIENCE,
  clientOrigin: process.env.CLIENT_ORIGIN,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
  // Optional: a second model tried when the first is busy or slow.
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL?.trim() || null,
  // Optional lesson-writing settings (background queue; single process only).
  lessonGenConcurrency: positiveInt('LESSON_GEN_CONCURRENCY', 2),
  lessonAttemptTimeoutMs: positiveInt('LESSON_ATTEMPT_TIMEOUT_MS', 60_000),
  lessonTotalTimeoutMs: positiveInt('LESSON_TOTAL_TIMEOUT_MS', 120_000),
});

export default config;
