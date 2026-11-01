import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // config/env.js exits the process when these are missing; tests never talk to the real services.
    env: {
      PORT: '5999',
      MONGODB_URI: 'mongodb://unused-in-tests',
      AUTH0_ISSUER_BASE_URL: 'https://example.auth0.test/',
      AUTH0_AUDIENCE: 'https://api.test',
      CLIENT_ORIGIN: 'http://localhost:5173',
      GEMINI_API_KEY: 'test-key',
      GEMINI_MODEL: 'test-model',
    },
    testTimeout: 30_000,
    hookTimeout: 120_000, // first run downloads a mongod binary for mongodb-memory-server
  },
});
