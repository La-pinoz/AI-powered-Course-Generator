// CLIENT_ORIGIN is one origin or a comma-separated list. CORS compares each one exactly.
export const parseClientOrigins = (raw = '') =>
  raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
