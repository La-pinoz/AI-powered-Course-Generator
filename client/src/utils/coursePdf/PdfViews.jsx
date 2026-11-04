import { parseInlineText } from '../inlineText.js'

// The white PDF copy of a course: black text, thin boxes, nothing interactive. Plain elements with
// complete inline styles and no Chakra, because html2canvas measures and draws this from a clone
// without the app's stylesheets (see exportCoursePdf), so nothing here can rely on the app's CSS.

const MONO = 'Consolas, Menlo, "Liberation Mono", "Courier New", monospace'
const BLACK = '#000000'

const box = { border: `1px solid ${BLACK}`, borderRadius: '4px', padding: '10px 12px', boxSizing: 'border-box' }
const bold = { fontWeight: 700 }
const label = { fontSize: '11px', fontWeight: 700 }
const wrap = { overflowWrap: 'break-word' }

function Inline({ text }) {
  return parseInlineText(text).map((part, index) => {
    if (part.type === 'bold') {
      return (
        <strong key={index} style={bold}>
          {part.text}
        </strong>
      )
    }
    if (part.type === 'code') {
      return (
        <code key={index} style={{ fontFamily: MONO, fontSize: '0.92em', ...wrap }}>
          {part.text}
        </code>
      )
    }
    return part.text
  })
}

export const HeadingView = ({ block }) => (
  <div style={{ ...bold, fontSize: '16px', lineHeight: '1.35', ...wrap }}>
    <Inline text={block.text} />
  </div>
)

export const ParagraphView = ({ block }) => (
  <div style={wrap}>
    <Inline text={block.text} />
  </div>
)

// Markers are real text: html2canvas's drawing of list-style markers isn't reliable.
export const ListView = ({ block }) => (
  <div>
    {block.items.map((item, index) => (
      <div key={index} style={{ display: 'flex', marginTop: index > 0 ? '4px' : '0' }}>
        <span style={{ flex: '0 0 22px' }}>{block.ordered ? `${index + 1}.` : '•'}</span>
        <div style={{ flex: '1 1 auto', minWidth: '0', ...wrap }}>
          <Inline text={item} />
        </div>
      </div>
    ))}
  </div>
)

export const CodeView = ({ block }) => (
  <div style={box}>
    <div style={label}>{block.language}</div>
    <div
      style={{
        marginTop: '4px',
        fontFamily: MONO,
        fontSize: '12px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        ...wrap,
      }}
    >
      {block.text}
    </div>
  </div>
)

export const ExampleView = ({ block }) => (
  <div style={box}>
    <div style={label}>Example</div>
    <div style={{ ...bold, marginTop: '2px', ...wrap }}>
      <Inline text={block.title} />
    </div>
    <div style={{ marginTop: '4px', ...wrap }}>
      <Inline text={block.text} />
    </div>
  </div>
)

const CALLOUT_LABELS = { tip: 'Tip', note: 'Note', warning: 'Warning' }

export const CalloutView = ({ block }) => (
  <div style={box}>
    <div style={label}>{CALLOUT_LABELS[block.tone] ?? CALLOUT_LABELS.note}</div>
    <div style={{ marginTop: '4px', ...wrap }}>
      <Inline text={block.text} />
    </div>
  </div>
)

export function CourseTitle({ title }) {
  return <div style={{ ...bold, fontSize: '28px', lineHeight: '1.25', paddingBottom: '10px', ...wrap }}>{title}</div>
}

export function ModuleHeading({ module }) {
  return (
    <div
      style={{
        ...bold,
        fontSize: '22px',
        lineHeight: '1.3',
        paddingBottom: '4px',
        borderBottom: `2px solid ${BLACK}`,
        ...wrap,
      }}
    >
      Module {module.order}: {module.title}
    </div>
  )
}

export function LessonHeading({ lesson }) {
  return (
    <div style={{ ...bold, fontSize: '18px', lineHeight: '1.3', ...wrap }}>
      Lesson {lesson.order}: {lesson.title}
    </div>
  )
}

export const QuizHeading = () => <div style={{ ...bold, fontSize: '16px', lineHeight: '1.35' }}>Quiz</div>

const LETTERS = 'ABCDEFGHIJ'

export function QuestionView({ block, number }) {
  return (
    <div style={box}>
      <div style={{ ...bold, ...wrap }}>
        {number}. <Inline text={block.question} />
      </div>
      <div style={{ marginTop: '4px' }}>
        {block.options.map((option, index) => (
          <div key={index} style={wrap}>
            {LETTERS[index]}. <Inline text={option} />
          </div>
        ))}
      </div>
      <div style={{ ...bold, marginTop: '6px', ...wrap }}>
        Answer: {LETTERS[block.answer]}. <Inline text={block.options[block.answer]} />
      </div>
      <div style={{ marginTop: '2px', ...wrap }}>
        <Inline text={block.explanation} />
      </div>
    </div>
  )
}
