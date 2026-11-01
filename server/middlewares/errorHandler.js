import { UnauthorizedError } from 'express-oauth2-jwt-bearer';

// Every failure leaves the API as `{ message }`. No stack traces.
// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ message: 'Please log in again.' });
  }

  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error('[error]', err);

  // 502 (AI failure) and 504 (AI timeout) carry user-facing messages; other 5xx stay generic.
  const exposed = status === 502 || status === 504;
  const message = status >= 500 && !exposed ? 'Something went wrong. Please try again.' : err.message;
  return res.status(status).json({ message });
}
