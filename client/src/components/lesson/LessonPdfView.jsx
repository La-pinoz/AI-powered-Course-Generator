import { parseInlineText } from '../../utils/inlineText.js'
import { READING_KIND_LABELS } from '../../utils/readingKinds.js'

// The lesson as it should look in the PDF. It is rendered off-screen and photographed by html2canvas.
//
// Why inline styles only: html2canvas can't read some modern CSS that Tailwind uses (like `oklch()`
// colors), so the exporter removes the app's stylesheets before capturing. Everything this view needs
// must therefore be in `style={...}`.
//
// Each direct child of the root is captured as one image, so a block is never cut between two pages.
// A section heading shares a child with its first item, so it is never left alone at a page's end.

const COLORS = { text: '#1F2421', muted: '#6B675E', line: '#E7E0D2', accent: '#E2583E', success: '#4F6B1A' }

const block = { paddingBottom: 14, fontSize: 14, lineHeight: 1.6, color: COLORS.text }
const box = { border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 12 }

function Inline({ text }) {
  return parseInlineText(text).map((part, index) => {
    if (part.type === 'bold') return <strong key={index}>{part.text}</strong>
    if (part.type === 'code') {
      return (
        <code key={index} style={{ fontFamily: 'Consolas, monospace', background: '#F4F1EA', padding: '0 3px' }}>
          {part.text}
        </code>
      )
    }
    return part.text
  })
}

function PdfBlock({ item }) {
  switch (item.type) {
    case 'heading':
      return (
        <h3 style={{ ...block, fontSize: 18, margin: 0, paddingTop: 6 }}>
          <Inline text={item.text} />
        </h3>
      )
    case 'paragraph':
      return (
        <p style={{ ...block, margin: 0 }}>
          <Inline text={item.text} />
        </p>
      )
    case 'list': {
      const List = item.ordered ? 'ol' : 'ul'
      return (
        <div style={block}>
          <List style={{ margin: 0, paddingLeft: 22 }}>
            {item.items.map((text, index) => (
              <li key={index}>
                <Inline text={text} />
              </li>
            ))}
          </List>
        </div>
      )
    }
    case 'code':
      return (
        <div style={block}>
          <pre
            style={{
              ...box,
              margin: 0,
              background: '#F4F1EA',
              fontFamily: 'Consolas, monospace',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {item.text}
          </pre>
        </div>
      )
    case 'example':
      return (
        <div style={block}>
          <div style={{ ...box, borderLeft: `4px solid ${COLORS.accent}` }}>
            <strong>Example: </strong>
            <Inline text={item.title} />
            <div style={{ marginTop: 6 }}>
              <Inline text={item.text} />
            </div>
          </div>
        </div>
      )
    case 'callout':
      return (
        <div style={block}>
          <div style={box}>
            <strong style={{ textTransform: 'capitalize' }}>{item.tone || 'note'}: </strong>
            <Inline text={item.text} />
          </div>
        </div>
      )
    case 'mcq':
      return (
        <div style={block}>
          <div style={box}>
            <strong>
              <Inline text={item.question} />
            </strong>
            <ol type="A" style={{ margin: '6px 0', paddingLeft: 22 }}>
              {item.options.map((option, index) => (
                <li key={index}>
                  <Inline text={option} />
                </li>
              ))}
            </ol>
            <div style={{ color: COLORS.success }}>
              Answer: {String.fromCharCode(65 + item.answer)}. <Inline text={item.explanation} />
            </div>
          </div>
        </div>
      )
    default:
      return null
  }
}

// The search phrase is printed because links can't be clicked in the image-based PDF.
function PdfReading({ reading }) {
  return (
    <div style={{ ...block, paddingBottom: 8, wordBreak: 'break-word' }}>
      <strong>{READING_KIND_LABELS[reading.kind]}: </strong>
      <Inline text={reading.title} />
      <span style={{ color: COLORS.muted }}> · Search: {reading.searchQuery}</span>
    </div>
  )
}

// A heading and its items, as separate root children except that the heading is wrapped together
// with the first item. Renders nothing without items.
function Section({ title, children }) {
  const [first, ...rest] = children
  if (!first) return null
  return (
    <>
      <div>
        <h2 style={{ ...block, fontSize: 20, margin: 0, paddingTop: 10 }}>{title}</h2>
        {first}
      </div>
      {rest}
    </>
  )
}

// React 19 passes `ref` as a normal prop.
export default function LessonPdfView({ lesson, ref }) {
  const content = lesson.content ?? []
  const explanation = content.filter((item) => item.type !== 'mcq')
  const questions = content.filter((item) => item.type === 'mcq')
  const readings = lesson.readings ?? []

  return (
    <div ref={ref} style={{ width: 700, background: '#FFFFFF', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ ...block, paddingBottom: 20 }}>
        <div style={{ color: COLORS.muted, fontSize: 12 }}>
          Module {lesson.moduleOrder} · {lesson.moduleTitle}
        </div>
        <h1 style={{ margin: '4px 0 0', fontSize: 26, lineHeight: 1.25 }}>
          Lesson {lesson.order}: {lesson.title}
        </h1>
      </div>

      {lesson.objectives?.length > 0 && (
        <div style={block}>
          <strong>In this lesson you will:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 22 }}>
            {lesson.objectives.map((objective, index) => (
              <li key={index}>{objective}</li>
            ))}
          </ul>
        </div>
      )}

      {explanation.map((item, index) => (
        <PdfBlock key={index} item={item} />
      ))}

      <Section title="Quiz">
        {questions.map((item, index) => (
          <PdfBlock key={`q${index}`} item={item} />
        ))}
      </Section>

      <Section title="Further reading">
        {readings.map((reading, index) => (
          <PdfReading key={`r${index}`} reading={reading} />
        ))}
      </Section>
    </div>
  )
}
