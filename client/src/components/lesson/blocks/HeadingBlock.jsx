import InlineText from './InlineText.jsx'

export default function HeadingBlock({ block }) {
  return (
    <h3 className="mt-2 text-xl font-medium">
      <InlineText text={block.text} />
    </h3>
  )
}
