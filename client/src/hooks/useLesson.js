import { useCallback, useEffect, useState } from 'react'
import useAuthedApi from './useAuthedApi.js'
import useCourses from './useCourses.js'
import { messageFor } from '../utils/errorMessage.js'

const POLL_MS = 3000

// Loads one lesson and, while the server is still writing it, polls every 3 s (paused while the tab
// is hidden). Status is 'loading' | 'pending' | 'generating' | 'ready' | 'failed' | 'notFound' | 'error'.
// Ready lessons are cached in CoursesContext, so going back to one is instant.
export default function useLesson(courseId, lessonId) {
  const request = useAuthedApi()
  const { lessons, cacheLesson, setLessonStatus } = useCourses()

  const cached = lessons[lessonId] ?? null
  // The last network result, tagged with the lesson it belongs to so a stale one is never shown.
  const [fetched, setFetched] = useState({ lessonId: null, status: 'loading', lesson: null, error: null })
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (cached) return undefined

    const controller = new AbortController()
    const { signal } = controller
    let timer = null
    let waitingForVisible = false

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

    async function load() {
      try {
        const lesson = await request(`/courses/${courseId}/lessons/${lessonId}`, { signal })
        if (signal.aborted) return
        setLessonStatus(courseId, lessonId, lesson.status)
        if (lesson.status === 'ready') {
          cacheLesson(lesson) // from here on `cached` is set and this effect stops
          return
        }
        setFetched({ lessonId, status: lesson.status, lesson, error: null })
        if (lesson.status === 'pending' || lesson.status === 'generating') schedule()
      } catch (err) {
        if (signal.aborted || err?.name === 'AbortError') return
        setFetched({
          lessonId,
          status: err?.status === 404 ? 'notFound' : 'error',
          lesson: null,
          error: messageFor(err),
        })
      }
    }

    load()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [courseId, lessonId, cached, reloadTick, request, cacheLesson, setLessonStatus])

  const reload = useCallback(() => {
    setFetched({ lessonId: null, status: 'loading', lesson: null, error: null })
    setReloadTick((tick) => tick + 1)
  }, [])

  // Failed → asks the server to write it again, then goes back to polling.
  const retry = useCallback(async () => {
    setFetched((prev) => ({ ...prev, lessonId, status: 'pending', error: null }))
    try {
      await request(`/courses/${courseId}/lessons/${lessonId}/retry`, { method: 'POST' })
      // Straight away, so the outline's counts and polling follow even if the user has moved on.
      setLessonStatus(courseId, lessonId, 'pending')
    } catch (err) {
      if (err?.status !== 409) {
        // 409 means it is ready already (another tab); reloading shows it.
        setFetched({ lessonId, status: 'error', lesson: null, error: messageFor(err) })
        return
      }
    }
    setReloadTick((tick) => tick + 1)
  }, [request, courseId, lessonId, setLessonStatus])

  if (cached) return { status: 'ready', lesson: cached, error: null, retry, reload }
  const current =
    fetched.lessonId === lessonId ? fetched : { status: 'loading', lesson: null, error: null }
  return { status: current.status, lesson: current.lesson, error: current.error, retry, reload }
}
