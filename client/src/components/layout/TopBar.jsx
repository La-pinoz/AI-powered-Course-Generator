import { useAuth0 } from '@auth0/auth0-react'

// Menu button (small screens only), then the signed-in user and Log out.
export default function TopBar({ user, onOpenMenu }) {
  const { logout } = useAuth0()

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-line bg-cream/95 px-4 backdrop-blur md:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-2xl leading-none hover:bg-line md:hidden"
      >
        ☰
      </button>

      <div className="ml-auto flex items-center gap-3">
        {user.picture ? (
          <img src={user.picture} alt="" className="h-9 w-9 rounded-full" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-semibold text-white">
            {user.name?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <span className="hidden max-w-48 truncate font-medium sm:inline">{user.name}</span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Log out
        </button>
      </div>
    </header>
  )
}
