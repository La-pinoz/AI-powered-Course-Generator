import InlineText from './InlineText.jsx'

export default function ParagraphBlock({ block }) {
  return (
    <p className="leading-relaxed">
      <InlineText text={block.text} />
    </p>
  )
}
