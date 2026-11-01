import 'dotenv/config';

const REQUIRED = [
  'PORT',
  'MONGODB_URI',
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_AUDIENCE',
  'CLIENT_ORIGIN',
];

const missing = REQUIRED.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(
    `[config] Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Set them in server/.env (see server/.env.example).',
  );
  process.exit(1);
}

const config = Object.freeze({
  port: Number(process.env.PORT),
  mongodbUri: process.env.MONGODB_URI,
  auth0IssuerBaseUrl: process.env.AUTH0_ISSUER_BASE_URL,
  auth0Audience: process.env.AUTH0_AUDIENCE,
  clientOrigin: process.env.CLIENT_ORIGIN,
});

export default config;
