import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMatch } from 'react-router-dom'
import useAuthedApi from '../hooks/useAuthedApi.js'
import usePolling from '../hooks/usePolling.js'
import { messageFor } from '../utils/errorMessage.js'
import { CoursesContext } from './coursesContext.js'

// Global state for the logged-in app:
// - `courses`: the user's course list (sidebar and dashboard).
// - `outline`: the modules and lessons of the course in the URL (sidebar, course, lesson and video pages).
// Both are re-fetched from the server after a change; nothing is cached or updated optimistically.
export function CoursesProvider({ children }) {
  const request = useAuthedApi()

  const [courses, setCourses] = useState([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState(null)

  const refreshCourses = useCallback(async () => {
    try {
      const data = await request('/courses')
      setCourses(data.courses)
      setCoursesError(null)
    } catch (err) {
      setCoursesError(messageFor(err))
    } finally {
      setCoursesLoading(false)
    }
  }, [request])

  useEffect(() => {
    refreshCourses()
  }, [refreshCourses])

  // The course id in the URL, e.g. /courses/:courseId/lessons/:lessonId. Null on the dashboard.
  const courseId = useMatch('/courses/:courseId/*')?.params.courseId ?? null

  const [outlineData, setOutlineData] = useState(null)
  const [outlineError, setOutlineError] = useState(null) // { courseId, message }

  const refreshOutline = useCallback(async () => {
    if (!courseId) return
    try {
      const data = await request(`/courses/${courseId}/outline`)
      setOutlineData(data.course)
      setOutlineError(null)
    } catch (err) {
      setOutlineError({ courseId, message: messageFor(err), notFound: err.status === 404 })
    }
  }, [request, courseId])

  useEffect(() => {
    refreshOutline()
  }, [refreshOutline])

  // A response for a course we have since left is ignored, so the page never shows the wrong course.
  const outline = outlineData && String(outlineData._id) === courseId ? outlineData : null
  const currentOutlineError = outlineError?.courseId === courseId ? outlineError : null

  // Lessons are written in the background after a course is created, so keep the statuses fresh
  // until every lesson is either ready or failed.
  const lessonsInProgress = Boolean(outline) && outline.lessonsReady + outline.lessonsFailed < outline.lessonsTotal
  usePolling(refreshOutline, lessonsInProgress)

  const value = useMemo(
    () => ({
      courses,
      coursesLoading,
      coursesError,
      refreshCourses,
      courseId,
      outline,
      outlineError: currentOutlineError,
      refreshOutline,
    }),
    [courses, coursesLoading, coursesError, refreshCourses, courseId, outline, currentOutlineError, refreshOutline],
  )

  return <CoursesContext.Provider value={value}>{children}</CoursesContext.Provider>
}
