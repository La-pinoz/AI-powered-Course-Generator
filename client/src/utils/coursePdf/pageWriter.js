// A4 portrait, in millimetres.
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 15
const TOP = MARGIN
const BOTTOM = PAGE_HEIGHT - MARGIN
const PAGE_NUMBER_Y = PAGE_HEIGHT - 7
const JPEG_QUALITY = 0.75
const MIN_SLICE = 10 // less space than this left on a page isn't worth starting a slice in

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const heightOf = (canvas) => (canvas.height / canvas.width) * CONTENT_WIDTH

// Lays captured canvases out on the PDF's pages, in the order they are added. Options per canvas:
// `gap` (mm above it, dropped at the top of a page), `newPage` and `keepWithNext` (for headings: held
// back until the block after them arrives, so they can move to a new page together).
export function createPageWriter(pdf) {
  let y = TOP
  let pageNumber = 0
  let held = []

  const numberPage = () => {
    pageNumber += 1
    pdf.setFontSize(9)
    pdf.setTextColor(0, 0, 0)
    pdf.text(String(pageNumber), PAGE_WIDTH / 2, PAGE_NUMBER_Y, { align: 'center' })
  }

  const nextPage = () => {
    pdf.addPage()
    y = TOP
    numberPage()
  }

  const drawImage = (dataUrl, height) => {
    pdf.addImage(dataUrl, 'JPEG', MARGIN, y, CONTENT_WIDTH, height)
    y += height
  }

  // Taller than a page: cut it at page boundaries, starting in the space left on this page.
  const drawSliced = (canvas, height) => {
    const pxPerMm = canvas.height / height
    let startPx = 0
    while (startPx < canvas.height) {
      if (BOTTOM - y < MIN_SLICE) nextPage()
      const endPx = Math.min(canvas.height, Math.floor(startPx + (BOTTOM - y) * pxPerMm))
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = Math.ceil(endPx - startPx)
      slice.getContext('2d').drawImage(canvas, 0, startPx, canvas.width, endPx - startPx, 0, 0, canvas.width, endPx - startPx)
      drawImage(slice.toDataURL('image/jpeg', JPEG_QUALITY), (endPx - startPx) / pxPerMm)
      slice.width = 0
      startPx = endPx
    }
  }

  // Something that doesn't fit normally moves to the next page. It is sliced instead if it's taller than
  // a page, or if it follows headings (which were kept with it), because moving it would strand them.
  const place = ({ canvas, height, gap }, index) => {
    if (y > TOP) y += gap
    const fits = y + height <= BOTTOM
    if (height > BOTTOM - TOP || (!fits && index > 0)) drawSliced(canvas, height)
    else {
      if (!fits) nextPage()
      drawImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), height)
    }
    canvas.width = 0 // releases the bitmap
  }

  const placeHeld = () => {
    const items = held
    held = []
    if (items.length === 0) return
    if (items[0].newPage && y > TOP) nextPage()
    const total = items.reduce((sum, item, index) => sum + item.height + (index > 0 || y > TOP ? item.gap : 0), 0)
    if (y > TOP && y + total > BOTTOM) nextPage()
    items.forEach(place)
  }

  numberPage()

  return {
    add(canvas, { gap = 0, newPage = false, keepWithNext = false } = {}) {
      if (newPage) placeHeld()
      held.push({ canvas, height: heightOf(canvas), gap, newPage })
      if (!keepWithNext) placeHeld()
    },
    finish: placeHeld,
  }
}
