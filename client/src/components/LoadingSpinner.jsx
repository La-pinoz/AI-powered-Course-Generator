// A spinning circle with a label. `fullScreen` centres it on the whole page (used before the app
// layout has loaded); otherwise it sits inline inside a page.
export default function LoadingSpinner({ label = 'Loading…', fullScreen = false }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-ink ${
        fullScreen ? 'min-h-screen flex-col bg-cream' : 'py-10'
      }`}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink/20 border-t-ink" />
      <p className="text-base font-medium">{label}</p>
    </div>
  )
}
