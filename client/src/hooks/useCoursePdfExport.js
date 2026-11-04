import { useCallback, useRef, useState } from 'react'
import { toaster } from '../components/dashboard/toaster.js'
import { exportCoursePdf } from '../utils/coursePdf/exportCoursePdf.jsx'
import { messageFor } from '../utils/errorMessage.js'
import useAuthedApi from './useAuthedApi.js'
import useCourses from './useCourses.js'

const GENERIC_FAILURE = 'Something went wrong while creating the PDF. Please try again.'

// One export at a time per tab. Used by the top bar, which stays mounted across dashboard routes, so
// moving to another page doesn't cancel an export. `activeExport` is { courseId, done, total } or null.
export default function useCoursePdfExport() {
  const request = useAuthedApi()
  const { lessons } = useCourses()
  const [activeExport, setActiveExport] = useState(null)
  const running = useRef(false)

  const startExport = useCallback(
    async (courseId, outline) => {
      if (running.current) return
      running.current = true
      setActiveExport({ courseId, done: 0, total: outline.lessonsTotal })

      const getLesson = async (lessonId) => {
        if (lessons[lessonId]) return lessons[lessonId]
        try {
          return await request(`/courses/${courseId}/lessons/${lessonId}`)
        } catch (err) {
          throw Object.assign(new Error(messageFor(err)), { userFacing: true })
        }
      }

      try {
        await exportCoursePdf({
          title: outline.title,
          modules: outline.modules,
          getLesson,
          onProgress: (done, total) => setActiveExport({ courseId, done, total }),
        })
      } catch (err) {
        if (!err?.userFacing) console.error('Course PDF export failed', err)
        toaster.create({
          title: "Couldn't create the PDF",
          description: err?.userFacing ? err.message : GENERIC_FAILURE,
          type: 'error',
          closable: true,
        })
      } finally {
        running.current = false
        setActiveExport(null)
      }
    },
    [request, lessons],
  )

  return { activeExport, startExport }
}
