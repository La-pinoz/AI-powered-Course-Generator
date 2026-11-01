import { Auth0Provider } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'

// Must sit inside <BrowserRouter> so the post-login redirect can use client-side navigation.
export default function Auth0ProviderWithNavigate({ children }) {
  const navigate = useNavigate()

  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: 'openid profile email offline_access',
      }}
      // Required so Safari and Brave don't log the user out on every refresh.
      useRefreshTokens={true}
      cacheLocation="localstorage"
      onRedirectCallback={(appState) =>
        navigate(appState?.returnTo || '/dashboard', { replace: true })
      }
    >
      {children}
    </Auth0Provider>
  )
}
