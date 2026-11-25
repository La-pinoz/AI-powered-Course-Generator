import InlineText from './InlineText.jsx'

export default function ExampleBlock({ block }) {
  return (
    <aside className="rounded-xl border border-accent/30 border-l-4 border-l-accent bg-accent/5 p-4">
      <p className="text-xs font-semibold tracking-wide text-brand uppercase">Example</p>
      <h4 className="mt-1 font-semibold">
        <InlineText text={block.title} />
      </h4>
      <p className="mt-2 leading-relaxed">
        <InlineText text={block.text} />
      </p>
    </aside>
  )
}
