import { READING_KIND_LABELS } from '../../utils/readingKinds.js'
import { parseInlineText } from '../../utils/inlineText.js'
import InlineText from './blocks/InlineText.jsx'

// The title without its **bold** and `code` markers, for the link's spoken label.
const plainText = (text) =>
  parseInlineText(text)
    .map((part) => part.text)
    .join('')

// Where to read more after a lesson. Each link is a web search built by the server.
export default function FurtherReading({ readings }) {
  if (!readings?.length) return null

  return (
    <section className="card" aria-labelledby="further-reading-heading">
      <h2 id="further-reading-heading" className="text-2xl font-medium">
        Further reading
      </h2>
      <ul className="mt-3 divide-y divide-line">
        {readings.map((reading) => (
          <li key={reading.searchQuery} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <span className="w-28 text-sm text-muted">{READING_KIND_LABELS[reading.kind]}</span>
            <span className="min-w-0 flex-1 basis-48 break-words">
              <InlineText text={reading.title} />
            </span>
            <a
              href={reading.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Search for ${plainText(reading.title)} (web search, opens in a new tab)`}
              className="font-medium text-brand underline"
            >
              Search ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
