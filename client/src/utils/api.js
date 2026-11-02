const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // Empty or non-JSON body; fall through to the status check below.
  }

  if (!response.ok) {
    throw Object.assign(new Error(data?.message || `Request failed (${response.status})`), {
      status: response.status,
    })
  }
  return data
}

// GET a binary resource (e.g. lesson audio) as a Blob, with the bearer token. Errors are the same
// shape as apiRequest's: an Error with the server's `{ message }` and `status`.
export async function apiRequestBlob(path, { token, signal } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${path}`, { headers, signal })
  if (!response.ok) {
    let data = null
    try {
      data = await response.json()
    } catch {
      // Not JSON; use the generic message.
    }
    throw Object.assign(new Error(data?.message || `Request failed (${response.status})`), {
      status: response.status,
    })
  }
  return response.blob()
}
