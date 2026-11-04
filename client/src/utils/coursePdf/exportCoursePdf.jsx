import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import {
  CalloutView,
  CodeView,
  CourseTitle,
  ExampleView,
  HeadingView,
  LessonHeading,
  ListView,
  ModuleHeading,
  ParagraphView,
  QuestionView,
  QuizHeading,
} from './PdfViews.jsx'
import { createPageWriter } from './pageWriter.js'

const FETCH_CONCURRENCY = 4
const CAPTURE_SCALE = 2
const GAP = { title: 2, module: 4, lesson: 8, heading: 5, block: 3 } // mm above each piece

// Block type → view. `mcq` is handled separately and unknown types are skipped, like LessonRenderer.
const blockViews = {
  heading: HeadingView,
  paragraph: ParagraphView,
  list: ListView,
  code: CodeView,
  example: ExampleView,
  callout: CalloutView,
}

// The hidden copy. Off-screen rather than display: none, because html2canvas needs real layout. 680px
// is the 180mm of A4 content width at CSS's 96 pixels per inch.
const containerStyle = {
  position: 'fixed',
  left: '-10000px',
  top: '0',
  width: '680px',
  background: '#ffffff',
  color: '#000000',
  fontFamily: 'Arial, "Noto Sans", "Nirmala UI", "Noto Sans Devanagari", sans-serif',
  fontSize: '14px',
  lineHeight: '1.6',
  pointerEvents: 'none',
}

const pdfFilename = (title) => {
  const name = String(title ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 120)
    .trim()
  return `${name || 'course'}.pdf`
}

// lessonId → lesson with its content. Stops asking for more as soon as one fails.
async function fetchLessons(lessons, getLesson) {
  const results = new Map()
  let next = 0
  let failed = false
  const worker = async () => {
    while (next < lessons.length && !failed) {
      const { _id: id } = lessons[next]
      next += 1
      try {
        const lesson = await getLesson(id)
        if (lesson.status !== 'ready') {
          throw Object.assign(new Error('Some lessons are not ready yet. Try again in a moment.'), { userFacing: true })
        }
        results.set(id, lesson)
      } catch (err) {
        failed = true
        throw err
      }
    }
  }
  const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, lessons.length) }, worker)
  await Promise.all(workers)
  return results
}

// The pieces of one lesson, each captured separately: browsers limit canvas size, so a whole course
// can't be one capture, and this keeps page breaks between blocks.
function lessonPieces({ lesson, content, module, courseTitle }) {
  const pieces = []
  if (courseTitle) pieces.push({ node: <CourseTitle title={courseTitle} />, gap: GAP.title, keepWithNext: true })
  if (module) {
    pieces.push({
      node: <ModuleHeading module={module} />,
      gap: GAP.module,
      newPage: !courseTitle,
      keepWithNext: true,
    })
  }
  pieces.push({ node: <LessonHeading lesson={lesson} />, gap: GAP.lesson, keepWithNext: true })

  for (const block of content) {
    const View = blockViews[block.type]
    if (!View) continue
    const isHeading = block.type === 'heading'
    pieces.push({
      node: <View block={block} />,
      gap: isHeading ? GAP.heading : GAP.block,
      keepWithNext: isHeading,
    })
  }

  const questions = content.filter((block) => block.type === 'mcq')
  if (questions.length > 0) pieces.push({ node: <QuizHeading />, gap: GAP.heading, keepWithNext: true })
  questions.forEach((block, index) => {
    pieces.push({ node: <QuestionView block={block} number={index + 1} />, gap: GAP.block })
  })
  return pieces
}

// Builds the whole course's PDF in the browser and saves it. `modules` are the outline's, in order;
// `getLesson(id)` resolves to a lesson with its content; `onProgress(done, total)` follows each lesson.
// Any failure rejects, saves nothing and leaves nothing behind in the page. An error with `userFacing`
// has a message safe to show; anything else is an internal capture error.
export async function exportCoursePdf({ title, modules, getLesson, onProgress }) {
  const outlineLessons = modules.flatMap((module) => module.lessons)
  const fetched = await fetchLessons(outlineLessons, getLesson)

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  pdf.setProperties({ title })
  const pages = createPageWriter(pdf)

  const container = document.createElement('div')
  Object.assign(container.style, containerStyle)
  container.setAttribute('aria-hidden', 'true')
  document.body.appendChild(container)
  const root = createRoot(container)

  const captureOptions = {
    scale: CAPTURE_SCALE,
    backgroundColor: '#ffffff',
    logging: false,
    // html2canvas clones the document for every capture, so the dashboard is left out of the clone. Its
    // stylesheets go too: they are never needed here, and it can't parse colours like color-mix.
    ignoreElements: (element) => element.parentElement === document.body && element !== container,
    onclone: (clone) => {
      clone.querySelectorAll('style, link[rel="stylesheet"]').forEach((element) => element.remove())
    },
  }

  try {
    let done = 0
    for (const [moduleIndex, module] of modules.entries()) {
      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        const pieces = lessonPieces({
          lesson,
          content: fetched.get(lesson._id).content ?? [],
          module: lessonIndex === 0 ? module : null,
          courseTitle: moduleIndex === 0 && lessonIndex === 0 ? title : null,
        })
        flushSync(() => root.render(pieces.map((piece, index) => <div key={index}>{piece.node}</div>)))
        for (const [index, piece] of pieces.entries()) {
          pages.add(await html2canvas(container.children[index], captureOptions), piece)
        }
        done += 1
        onProgress?.(done, outlineLessons.length)
      }
    }
    pages.finish()
    pdf.save(pdfFilename(title))
  } finally {
    root.unmount()
    container.remove()
  }
}
