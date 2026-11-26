const CHIP = 'max-w-full break-words rounded-full border border-line bg-cream px-3 py-0.5 text-xs text-muted'

// Small display-only chips (course tags, lesson key topics). Renders nothing for an empty list.
// `max` shows only the first few, followed by "+n" for the rest.
// role="list" keeps it announced as a list even though the bullets are styled away.
export default function ChipList({ items, label, max = Infinity, className = '' }) {
  if (!items?.length) return null
  const hidden = Math.max(items.length - max, 0)

  return (
    <ul role="list" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {items.slice(0, max).map((item) => (
        <li key={item} className={CHIP}>
          {item}
        </li>
      ))}
      {hidden > 0 && (
        <li className={CHIP}>
          +{hidden}
          <span className="sr-only"> more</span>
        </li>
      )}
    </ul>
  )
}
