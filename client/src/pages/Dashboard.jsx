import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import { apiRequest } from '../utils/api.js'

export default function Dashboard() {
  const { getAccessTokenSilently, logout } = useAuth0()
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState(true)
  // Stops React StrictMode's double mount from calling the sync endpoint twice.
  const hasSynced = useRef(false)

  const syncUser = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const token = await getAccessTokenSilently()
      const data = await apiRequest('/users/sync', { method: 'POST', token })
      setUser(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }, [getAccessTokenSilently])

  useEffect(() => {
    if (hasSynced.current) return
    hasSynced.current = true
    syncUser()
  }, [syncUser])

  if (syncing) return <LoadingSpinner label="Setting up your account…" />

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF6EE] px-6">
        <ErrorMessage message={error} onRetry={syncUser} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#1F2421] px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <button
            type="button"
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            className="rounded border border-[#1F2421] px-4 py-2 text-sm font-medium hover:bg-[#1F2421] hover:text-[#FAF6EE]"
          >
            Log out
          </button>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Create a curriculum</h2>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Your past courses</h2>
        </section>
      </div>
    </div>
  )
}
