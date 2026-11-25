import { parseInlineText } from '../../../utils/inlineText.js'

// AI text may contain **bold** and `code`. We turn those into real <strong> and <code> elements and
// never insert the text as HTML, so it can't inject markup.
export default function InlineText({ text }) {
  return parseInlineText(text).map((part, index) => {
    if (part.type === 'bold') return <strong key={index}>{part.text}</strong>
    if (part.type === 'code') {
      return (
        <code key={index} className="rounded bg-line/60 px-1.5 py-0.5 font-mono text-[0.9em]">
          {part.text}
        </code>
      )
    }
    return part.text
  })
}
