import { describe, expect, it } from 'vitest'
import { PAGE, pdfFileName, placeOnPages } from '../src/utils/pdfLayout.js'

const contentWidth = PAGE.width - PAGE.margin * 2 // 180 mm
// An image that becomes `heightMm` tall once scaled to the content width.
const image = (heightMm) => ({ data: 'img', width: contentWidth, height: heightMm })

describe('placeOnPages', () => {
  it('stacks blocks top to bottom on the first page', () => {
    const placed = placeOnPages([image(50), image(30)])
    expect(placed.map((p) => [p.y, p.newPage])).toEqual([
      [PAGE.margin, false],
      [PAGE.margin + 50, false],
    ])
  })

  it('moves a block that does not fit to a new page', () => {
    const placed = placeOnPages([image(200), image(100)])
    expect(placed[1]).toMatchObject({ y: PAGE.margin, newPage: true })
  })

  it('scales images to the content width', () => {
    const [placed] = placeOnPages([{ data: 'img', width: 1400, height: 700 }])
    expect(placed.width).toBe(contentWidth)
    expect(placed.height).toBe(contentWidth / 2)
  })

  it('never starts a new page for the first block, even if it is taller than a page', () => {
    const [placed] = placeOnPages([image(400)])
    expect(placed.newPage).toBe(false)
  })
})

describe('pdfFileName', () => {
  it('turns a title into a safe file name', () => {
    expect(pdfFileName('Lesson 2 What is a Hook?')).toBe('lesson-2-what-is-a-hook.pdf')
  })

  it('falls back to lesson.pdf', () => {
    expect(pdfFileName('???')).toBe('lesson.pdf')
  })
})
