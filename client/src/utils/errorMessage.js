const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.'

// A user-facing message for anything a request can throw. fetch() rejects with a TypeError when the
// server can't be reached; Auth0 errors carry `.error`.
export const messageFor = (err) => {
  if (err instanceof TypeError) return NETWORK_ERROR
  if (err?.error) return 'Please log in again.'
  return err?.message || 'Something went wrong. Please try again.'
}
