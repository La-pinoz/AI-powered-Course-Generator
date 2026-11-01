const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // Empty or non-JSON body; fall through to the status check below.
  }

  if (!response.ok) {
    throw new Error(data?.message || `Request failed (${response.status})`)
  }
  return data
}
