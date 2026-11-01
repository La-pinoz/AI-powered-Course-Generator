import { UnauthorizedError } from 'express-oauth2-jwt-bearer';

// Every failure leaves the API as `{ message }`. No stack traces.
// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
  if (err instanceof UnauthorizedError) {
    return res.status(401).json({ message: 'Please log in again.' });
  }

  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error('[error]', err);

  const message = status >= 500 && status !== 502 ? 'Something went wrong. Please try again.' : err.message;
  return res.status(status).json({ message });
}
