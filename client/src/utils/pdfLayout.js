// A4 page size and margins, in millimetres.
export const PAGE = { width: 210, height: 297, margin: 15 }

// Decides where each block image goes in the PDF. Images are stacked top to bottom; when the next one
// doesn't fit on the current page, it starts a new page. Each image is scaled to the page's content
// width. `images` is [{ data, width, height }] in pixels; returns [{ data, x, y, width, height, newPage }]
// in millimetres.
export function placeOnPages(images) {
  const contentWidth = PAGE.width - PAGE.margin * 2
  const bottom = PAGE.height - PAGE.margin
  let y = PAGE.margin

  return images.map((image) => {
    const height = (image.height * contentWidth) / image.width
    // Only move to a new page if this page already has something on it, so a block taller than a
    // whole page is still placed (it gets cut at the bottom instead of looping forever).
    const newPage = y + height > bottom && y > PAGE.margin
    if (newPage) y = PAGE.margin
    const placed = { data: image.data, x: PAGE.margin, y, width: contentWidth, height, newPage }
    y += height
    return placed
  })
}

// "Lesson 2: What is a Hook?" → "lesson-2-what-is-a-hook.pdf"
export function pdfFileName(title) {
  const slug = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'lesson'}.pdf`
}
