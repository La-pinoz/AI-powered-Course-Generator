import { useCallback } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { apiRequest } from '../utils/api.js'

// Returns request(path, { method, body }) that attaches a fresh Auth0 access token.
export default function useAuthedApi() {
  const { getAccessTokenSilently } = useAuth0()

  return useCallback(
    async (path, options = {}) => {
      const token = await getAccessTokenSilently()
      return apiRequest(path, { ...options, token })
    },
    [getAccessTokenSilently],
  )
}
