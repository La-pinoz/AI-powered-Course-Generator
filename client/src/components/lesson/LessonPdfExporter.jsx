import { useRef, useState } from 'react'
import LessonPdfView from './LessonPdfView.jsx'
import { pdfFileName, placeOnPages } from '../../utils/pdfLayout.js'

// "Download PDF" for one lesson.
// 1. LessonPdfView renders the lesson off-screen (kept in a React ref).
// 2. html2canvas turns each of its blocks into an image.
// 3. jsPDF places the images on A4 pages and saves the file.
// Both libraries are large, so they are only downloaded when the button is clicked.
export default function LessonPdfExporter({ lesson }) {
  const viewRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])

      // Capture every block as an image.
      const images = []
      for (const element of viewRef.current.children) {
        const canvas = await html2canvas(element, {
          scale: 2,
          backgroundColor: '#FFFFFF',
          // Remove the app's stylesheets from html2canvas's copy of the page (see LessonPdfView).
          onclone: (doc) => doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove()),
        })
        images.push({ data: canvas.toDataURL('image/jpeg', 0.92), width: canvas.width, height: canvas.height })
      }

      // Lay them out on A4 pages.
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      for (const item of placeOnPages(images)) {
        if (item.newPage) pdf.addPage()
        pdf.addImage(item.data, 'JPEG', item.x, item.y, item.width, item.height)
      }
      pdf.save(pdfFileName(`Lesson ${lesson.order} ${lesson.title}`))
    } catch (err) {
      console.error(err)
      setError("Couldn't create the PDF. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button type="button" className="btn btn-secondary" onClick={download} disabled={busy}>
        {busy ? 'Creating PDF…' : '⬇ Download PDF'}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {/* Off-screen copy of the lesson that gets captured. aria-hidden: screen readers skip it. */}
      <div aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0 }}>
        <LessonPdfView ref={viewRef} lesson={lesson} />
      </div>
    </div>
  )
}
