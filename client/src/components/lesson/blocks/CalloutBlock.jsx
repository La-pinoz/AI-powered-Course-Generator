import InlineText from './InlineText.jsx'

const TONES = {
  tip: { label: '💡 Tip', className: 'border-success/40 bg-success/5' },
  note: { label: 'ℹ️ Note', className: 'border-line bg-white' },
  warning: { label: '⚠️ Warning', className: 'border-red-300 bg-red-50' },
}

export default function CalloutBlock({ block }) {
  const tone = TONES[block.tone] ?? TONES.note
  return (
    <aside className={`rounded-xl border p-4 ${tone.className}`}>
      <p className="text-sm font-semibold">{tone.label}</p>
      <p className="mt-1 leading-relaxed">
        <InlineText text={block.text} />
      </p>
    </aside>
  )
}
