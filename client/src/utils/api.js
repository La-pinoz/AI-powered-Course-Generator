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
