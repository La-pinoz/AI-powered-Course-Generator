// A simple progress bar, e.g. 3 of 12 lessons completed.
export default function ProgressBar({ value, max, label, className = '' }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`h-2 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      <div className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
    </div>
  )
}
