import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportCoursePdf } from '../src/utils/coursePdf/exportCoursePdf.jsx'

// Recording fakes for the two libraries, the only things this suite mocks (plus the lesson getter).
const library = vi.hoisted(() => ({
  documents: [],
  heightFor: () => 100,
  captureError: null,
  captured: [],
}))

vi.mock('html2canvas', () => ({
  default: async (element) => {
    if (library.captureError) throw library.captureError
    const text = element.textContent
    library.captured.push({ text, html: element.innerHTML })
    return {
      width: 1360,
      height: library.heightFor(text),
      toDataURL: () => `capture:${text}`,
    }
  },
}))

vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor() {
      this.pages = [{ images: [], texts: [] }]
      this.savedAs = null
      this.properties = null
      library.documents.push(this)
    }
    addPage() {
      this.pages.push({ images: [], texts: [] })
    }
    addImage(data, format, x, y, width, height) {
      this.pages.at(-1).images.push({ data, y, height })
    }
    text(text) {
      this.pages.at(-1).texts.push(text)
    }
    setFontSize() {}
    setTextColor() {}
    setProperties(properties) {
      this.properties = properties
    }
    save(name) {
      this.savedAs = name
    }
  },
}))

const ready = (id, content) => ({ id, status: 'ready', content })
const paragraph = (text) => ({ type: 'paragraph', text })

const outlineOf = (...modules) =>
  modules.map((lessons, moduleIndex) => ({
    _id: `m${moduleIndex + 1}`,
    order: moduleIndex + 1,
    title: `Mod ${moduleIndex + 1}`,
    lessons: lessons.map((id, lessonIndex) => ({ _id: id, order: lessonIndex + 1, title: `Title ${id}`, status: 'ready' })),
  }))

const getterFor = (lessons) => async (id) => lessons[id]
const pdf = () => library.documents.at(-1)
const pageTexts = (page) => page.images.map((image) => image.data.replace('capture:', ''))

beforeEach(() => {
  library.documents.length = 0
  library.captured.length = 0
  library.heightFor = () => 100
  library.captureError = null
  document.body.innerHTML = ''
})

describe('exportCoursePdf', () => {
  it('captures the course title, module, lesson and blocks in course order, then saves the file', async () => {
    await exportCoursePdf({
      title: 'Intro to React',
      modules: outlineOf(['l1', 'l2']),
      getLesson: getterFor({
        l1: ready('l1', [paragraph('first paragraph'), paragraph('second paragraph')]),
        l2: ready('l2', [paragraph('third paragraph')]),
      }),
    })

    expect(library.captured.map((c) => c.text)).toEqual([
      'Intro to React',
      'Module 1: Mod 1',
      'Lesson 1: Title l1',
      'first paragraph',
      'second paragraph',
      'Lesson 2: Title l2',
      'third paragraph',
    ])
    expect(pdf().savedAs).toBe('Intro to React.pdf')
    expect(pdf().properties.title).toBe('Intro to React')
  })

  describe('content', () => {
    const exportOne = (lesson) =>
      exportCoursePdf({ title: 'Course', modules: outlineOf(['l1']), getLesson: getterFor({ l1: lesson }) })
    const captured = (text) => library.captured.find((c) => c.text.includes(text))

    it('includes every explanation block type', async () => {
      await exportOne(
        ready('l1', [
          { type: 'heading', text: 'A subheading' },
          { type: 'list', ordered: true, items: ['one', 'two'] },
          { type: 'list', ordered: false, items: ['apple'] },
          { type: 'code', language: 'python', text: 'def f():\n    return 1' },
          { type: 'example', title: 'Worked sum', text: 'Two plus two' },
          { type: 'callout', tone: 'warning', text: 'Mind the gap' },
        ]),
      )

      const texts = library.captured.map((c) => c.text)
      expect(texts).toContain('A subheading')
      expect(texts).toContain('1.one2.two')
      expect(texts).toContain('•apple')
      expect(texts).toContain('pythondef f():\n    return 1')
      expect(texts).toContain('ExampleWorked sumTwo plus two')
      expect(texts).toContain('WarningMind the gap')
    })

    it('puts each question after the explanation with lettered options, its answer and explanation', async () => {
      await exportOne(
        ready('l1', [
          paragraph('explained'),
          {
            type: 'mcq',
            question: 'Which one?',
            options: ['First', 'Second', 'Third', 'Fourth'],
            answer: 2,
            explanation: 'Because three.',
          },
          { type: 'mcq', question: 'Another?', options: ['W', 'X', 'Y', 'Z'], answer: 0, explanation: 'Because W.' },
        ]),
      )

      const texts = library.captured.map((c) => c.text)
      expect(texts.slice(-4)).toEqual([
        'explained',
        'Quiz',
        '1. Which one?A. FirstB. SecondC. ThirdD. FourthAnswer: C. ThirdBecause three.',
        '2. Another?A. WB. XC. YD. ZAnswer: A. WBecause W.',
      ])
    })

    it('has no quiz heading for a lesson with no questions', async () => {
      await exportOne(ready('l1', [paragraph('only text')]))

      expect(library.captured.map((c) => c.text)).not.toContain('Quiz')
    })

    it('renders bold and inline code as formatting, and HTML in AI text as plain text', async () => {
      await exportOne(ready('l1', [paragraph('Use **care** with `map` and <script>alert(1)</script>')]))

      const { html, text } = captured('Use care')
      expect(text).toBe('Use care with map and <script>alert(1)</script>')
      expect(html).toMatch(/<strong[^>]*>care<\/strong>/)
      expect(html).toMatch(/<code[^>]*>map<\/code>/)
      expect(html).not.toContain('<script>')
    })

    it('leaves out objectives, the video query and unknown block types', async () => {
      await exportOne({
        ...ready('l1', [paragraph('kept'), { type: 'hologram', text: 'from the future' }]),
        objectives: ['Understand the secret objective'],
        videoQuery: 'secret video query',
      })

      const all = library.captured.map((c) => c.text).join(' ')
      expect(all).toContain('kept')
      expect(all).not.toContain('secret')
      expect(all).not.toContain('from the future')
    })
  })

  describe('progress, fetching and failures', () => {
    const course = (ids, getLesson, extra = {}) => ({
      title: 'Course',
      modules: outlineOf(ids),
      getLesson,
      ...extra,
    })
    const getReady = async (id) => ready(id, [paragraph(`text ${id}`)])

    it('reports progress per lesson up to the total', async () => {
      const onProgress = vi.fn()

      await exportCoursePdf(course(['l1', 'l2', 'l3'], getReady, { onProgress }))

      expect(onProgress.mock.calls).toEqual([
        [1, 3],
        [2, 3],
        [3, 3],
      ])
    })

    it('fetches a few lessons at a time and never more than four', async () => {
      const ids = Array.from({ length: 10 }, (_, index) => `l${index}`)
      let inFlight = 0
      let peak = 0
      const getLesson = async (id) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 2))
        inFlight -= 1
        return getReady(id)
      }

      await exportCoursePdf(course(ids, getLesson))

      expect(peak).toBe(4)
      expect(library.captured.filter((c) => c.text.startsWith('text '))).toHaveLength(10)
    })

    it('removes the hidden copy after a successful export', async () => {
      await exportCoursePdf(course(['l1'], getReady))

      expect(document.body.children).toHaveLength(0)
    })

    it('rejects, saves nothing and cleans up when a lesson cannot be fetched', async () => {
      const getLesson = async (id) => {
        if (id === 'l2') throw new Error('Could not reach the server.')
        return getReady(id)
      }

      await expect(exportCoursePdf(course(['l1', 'l2'], getLesson))).rejects.toThrow('Could not reach the server.')

      expect(library.documents.every((doc) => doc.savedAs === null)).toBe(true)
      expect(document.body.children).toHaveLength(0)
    })

    it('asks for no more lessons once one has failed', async () => {
      const ids = Array.from({ length: 12 }, (_, index) => `l${index}`)
      const asked = []
      const getLesson = async (id) => {
        asked.push(id)
        await new Promise((resolve) => setTimeout(resolve, 1))
        if (id === 'l0') throw new Error('Could not reach the server.')
        return getReady(id)
      }

      await expect(exportCoursePdf(course(ids, getLesson))).rejects.toThrow('Could not reach the server.')
      await new Promise((resolve) => setTimeout(resolve, 30))

      expect(asked).toEqual(['l0', 'l1', 'l2', 'l3'])
    })

    it('rejects and saves nothing when a lesson is no longer ready', async () => {
      const getLesson = async (id) => ({ id, status: 'generating', content: [] })

      await expect(exportCoursePdf(course(['l1'], getLesson))).rejects.toThrow(/not ready/i)

      expect(library.documents.every((doc) => doc.savedAs === null)).toBe(true)
    })

    it('rejects, saves nothing and cleans up when a capture fails', async () => {
      library.captureError = new Error('Canvas failed')

      await expect(exportCoursePdf(course(['l1'], getReady))).rejects.toThrow('Canvas failed')

      expect(library.documents.every((doc) => doc.savedAs === null)).toBe(true)
      expect(document.body.children).toHaveLength(0)
    })
  })

  describe('filename', () => {
    const saveAs = async (title) => {
      await exportCoursePdf({
        title,
        modules: outlineOf(['l1']),
        getLesson: getterFor({ l1: ready('l1', [paragraph('x')]) }),
      })
      return pdf().savedAs
    }

    it('removes characters filenames cannot use and tidies whitespace', async () => {
      expect(await saveAs('  C++: a/b   what?. ')).toBe('C++ a b what.pdf')
    })

    it('keeps non-Latin titles', async () => {
      expect(await saveAs('गणित की मूल बातें')).toBe('गणित की मूल बातें.pdf')
    })

    it('falls back when nothing usable is left', async () => {
      expect(await saveAs('///')).toBe('course.pdf')
    })
  })

  describe('page layout', () => {
    // Fake canvases are 1360px wide for the 180mm content width of an A4 page with 15mm margins.
    const mm = (value) => (value * 1360) / 180
    const heights = (table) => (text) => mm(table[text] ?? 5)

    const twoModules = {
      title: 'Course',
      modules: outlineOf(['l1'], ['l2']),
      getLesson: getterFor({
        l1: ready('l1', [paragraph('alpha')]),
        l2: ready('l2', [paragraph('beta')]),
      }),
    }

    it('keeps Module 1 on page 1 and starts each later module on a new page', async () => {
      await exportCoursePdf(twoModules)

      expect(pdf().pages).toHaveLength(2)
      expect(pageTexts(pdf().pages[0])).toEqual(['Course', 'Module 1: Mod 1', 'Lesson 1: Title l1', 'alpha'])
      expect(pageTexts(pdf().pages[1])).toEqual(['Module 2: Mod 2', 'Lesson 1: Title l2', 'beta'])
    })

    it('numbers every page', async () => {
      await exportCoursePdf(twoModules)

      expect(pdf().pages.map((page) => page.texts)).toEqual([['1'], ['2']])
    })

    it('moves a block that does not fit to the next page', async () => {
      library.heightFor = heights({ tall: 150, taller: 150 })

      await exportCoursePdf({
        title: 'Course',
        modules: outlineOf(['l1']),
        getLesson: getterFor({ l1: ready('l1', [paragraph('tall'), paragraph('taller')]) }),
      })

      expect(pageTexts(pdf().pages[0]).at(-1)).toBe('tall')
      expect(pageTexts(pdf().pages[1])).toEqual(['taller'])
    })

    it('keeps a heading with the block after it', async () => {
      library.heightFor = heights({ filler: 200, after: 40 })

      await exportCoursePdf({
        title: 'Course',
        modules: outlineOf(['l1']),
        getLesson: getterFor({
          l1: ready('l1', [paragraph('filler'), { type: 'heading', text: 'Sub heading' }, paragraph('after')]),
        }),
      })

      expect(pageTexts(pdf().pages[0]).at(-1)).toBe('filler')
      expect(pageTexts(pdf().pages[1])).toEqual(['Sub heading', 'after'])
    })

    it('never leaves headings alone when they and the next block together exceed a page', async () => {
      const drawImage = vi.fn()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage })
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('capture:slice')
      // Fits on a page by itself (267mm of content height), but not below the title and headings.
      library.heightFor = heights({ 'nearly a page': 262 })

      await exportCoursePdf({
        title: 'Course',
        modules: outlineOf(['l1']),
        getLesson: getterFor({ l1: ready('l1', [paragraph('nearly a page')]) }),
      })

      expect(pageTexts(pdf().pages[0])).toEqual(['Course', 'Module 1: Mod 1', 'Lesson 1: Title l1', 'slice'])
      expect(pageTexts(pdf().pages[1])).toEqual(['slice'])
      vi.restoreAllMocks()
    })

    it('splits a block taller than a page across pages, staying inside the margins', async () => {
      const drawImage = vi.fn()
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage })
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('capture:slice')
      library.heightFor = heights({ huge: 600 })

      await exportCoursePdf({
        title: 'Course',
        modules: outlineOf(['l1']),
        getLesson: getterFor({ l1: ready('l1', [paragraph('huge')]) }),
      })

      const slices = pdf().pages.flatMap((page) => page.images).filter((image) => image.data === 'capture:slice')
      expect(pdf().pages.length).toBeGreaterThanOrEqual(3)
      expect(slices.reduce((sum, slice) => sum + slice.height, 0)).toBeCloseTo(600, 3)
      for (const page of pdf().pages) {
        for (const image of page.images) {
          expect(image.y).toBeGreaterThanOrEqual(15)
          expect(image.y + image.height).toBeLessThanOrEqual(282 + 0.001)
        }
      }
      vi.restoreAllMocks()
    })
  })
})
