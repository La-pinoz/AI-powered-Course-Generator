import { withAuthenticationRequired } from '@auth0/auth0-react'
import LoadingSpinner from './LoadingSpinner.jsx'

// Wrap a page in <ProtectedRoute> so unauthenticated visitors are sent to
// Auth0 Universal Login, then returned to the page they asked for.
const ProtectedRoute = withAuthenticationRequired(({ children }) => children, {
  onRedirecting: () => <LoadingSpinner />,
})

export default ProtectedRoute
