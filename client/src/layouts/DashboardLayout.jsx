import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import Sidebar from '../components/layout/Sidebar.jsx'
import TopBar from '../components/layout/TopBar.jsx'
import { CoursesProvider } from '../context/CoursesContext.jsx'
import { apiRequest } from '../utils/api.js'
import { messageFor } from '../utils/errorMessage.js'

// The protected layout for /dashboard and /courses/*: sidebar on the left, top bar and page on the
// right. First it saves the Auth0 user in our database (POST /users/sync).
export default function DashboardLayout() {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  // True when Auth0 itself refused to give us a token (e.g. the saved session expired). Retrying
  // can't fix that; only a fresh login can.
  const [needsLogin, setNeedsLogin] = useState(false)
  // On small screens the sidebar is hidden until the menu button opens it.
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const syncUser = useCallback(async () => {
    setError(null)
    setNeedsLogin(false)
    try {
      const token = await getAccessTokenSilently()
      const data = await apiRequest('/users/sync', { method: 'POST', token })
      setUser(data.user)
    } catch (err) {
      // Auth0 errors carry an `error` code such as 'login_required' or 'missing_refresh_token'.
      if (err.error) {
        console.error('Auth0 could not get an access token:', err.error, err.message)
        setNeedsLogin(true)
      }
      setError(messageFor(err))
    }
  }, [getAccessTokenSilently])

  useEffect(() => {
    syncUser()
  }, [syncUser])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        {needsLogin ? (
          <ErrorMessage
            message="Your session has expired."
            retryLabel="Log in again"
            // After logging in, come back to the page the user was trying to open.
            onRetry={() => loginWithRedirect({ appState: { returnTo: location.pathname } })}
          />
        ) : (
          <ErrorMessage message={error} onRetry={syncUser} />
        )}
      </div>
    )
  }

  if (!user) return <LoadingSpinner label="Setting up your account…" fullScreen />

  return (
    <CoursesProvider>
      <div className="app min-h-dvh bg-cream text-ink md:flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} onOpenMenu={() => setSidebarOpen(true)} />
          <main className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </CoursesProvider>
  )
}
