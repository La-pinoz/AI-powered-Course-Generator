import { useEffect } from 'react'
import useCourses from './useCourses.js'

const POLL_MS = 3000

// While any lesson of this course is still being written, re-reads the lesson statuses every 3 s
// (paused while the tab is hidden), so the readiness counts move without opening each lesson. It stops
// when none is in progress, and a Retry that puts a lesson back in progress starts it again.
export default function useOutlineStatusPolling(courseId) {
  const { outlines, refreshLessonStatuses } = useCourses()
  const data = courseId ? outlines[courseId]?.data : null
  const inProgress = Boolean(data) && data.lessonsReady + data.lessonsFailed < data.lessonsTotal

  useEffect(() => {
    if (!courseId || !inProgress) return undefined

    const controller = new AbortController()
    let timer = null
    let waitingForVisible = false

    const load = async () => {
      try {
        await refreshLessonStatuses(courseId, { signal: controller.signal })
      } catch {
        // A missed refresh only delays the count; the next one tries again.
      }
      if (!controller.signal.aborted) schedule()
    }

    const schedule = () => {
      timer = setTimeout(() => {
        if (document.hidden) waitingForVisible = true
        else load()
      }, POLL_MS)
    }

    const onVisibility = () => {
      if (!document.hidden && waitingForVisible) {
        waitingForVisible = false
        load()
      }
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [courseId, inProgress, refreshLessonStatuses])
}
