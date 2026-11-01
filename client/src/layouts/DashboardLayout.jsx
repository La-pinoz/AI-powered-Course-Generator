import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { Box, ChakraProvider, Flex, SkipNavLink } from '@chakra-ui/react'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import AppToaster from '../components/dashboard/AppToaster.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import SidebarDrawer from '../components/dashboard/SidebarDrawer.jsx'
import TopBar from '../components/dashboard/TopBar.jsx'
import { CoursesProvider } from '../context/CoursesContext.jsx'
import { apiRequest } from '../utils/api.js'
import { system } from '../theme/system.js'

// Everything inside is Chakra and dark-only. It is mounted only after the user sync succeeds, so
// the Tailwind spinner/error below are what the user sees before that.
function DashboardShell({ user }) {
  const { pathname } = useLocation()
  // The drawer is open only for the pathname it was opened at, so any navigation closes it.
  const [drawerPath, setDrawerPath] = useState(null)
  const drawerOpen = drawerPath === pathname
  const setDrawerOpen = useCallback((open) => setDrawerPath(open ? pathname : null), [pathname])
  const menuButtonRef = useRef(null)

  // Portaled UI (menus, dialogs, the drawer) renders outside the layout root, so the dark theme
  // class also goes on <html> while the dashboard is mounted. The landing page never has it.
  useEffect(() => {
    document.documentElement.classList.add('dark')
    return () => document.documentElement.classList.remove('dark')
  }, [])

  // Also close the drawer when the viewport grows past the mobile breakpoint.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const onChange = (event) => {
      if (event.matches) setDrawerOpen(false)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [setDrawerOpen])

  return (
    <ChakraProvider value={system}>
      <CoursesProvider>
        <Box
          className="dark"
          colorPalette="accent"
          style={{ colorScheme: 'dark' }}
          bg="bg.app"
          color="fg"
          fontFamily="body"
          minH="100dvh"
          h={{ md: '100dvh' }}
          overflow={{ md: 'hidden' }}
          display={{ md: 'flex' }}
        >
          {/* `id` is the target of the link's href; it matches <main id="main"> below. */}
          <SkipNavLink id="main">Skip to main content</SkipNavLink>

          <Box hideBelow="md" w={{ md: '240px', lg: '280px' }} flexShrink="0" h="full">
            <Sidebar />
          </Box>
          <SidebarDrawer open={drawerOpen} onOpenChange={setDrawerOpen} finalFocusRef={menuButtonRef} />

          <Flex direction="column" flex="1" minW="0" overflowY={{ md: 'auto' }}>
            <TopBar user={user} onOpenMenu={() => setDrawerOpen(true)} menuButtonRef={menuButtonRef} />
            <Box
              as="main"
              id="main"
              tabIndex={-1}
              flex="1"
              w="full"
              maxW="1200px"
              mx="auto"
              p={{ base: '4', md: '8' }}
              _focusVisible={{ outline: 'none' }}
            >
              <Outlet context={{ user }} />
            </Box>
          </Flex>

          <AppToaster />
        </Box>
      </CoursesProvider>
    </ChakraProvider>
  )
}

// Protected layout route for /dashboard and /courses/*. Syncs the user with the API once.
export default function DashboardLayout() {
  const { getAccessTokenSilently } = useAuth0()
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

  return <DashboardShell user={user} />
}
