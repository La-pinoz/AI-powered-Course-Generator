export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#FAF6EE] text-[#1F2421]"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1F2421]/20 border-t-[#1F2421]" />
      <p className="text-base font-medium">{label}</p>
    </div>
  )
}
