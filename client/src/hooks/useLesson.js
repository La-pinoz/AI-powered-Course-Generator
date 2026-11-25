import { useCallback, useEffect, useState } from 'react'
import useAuthedApi from './useAuthedApi.js'
import usePolling from './usePolling.js'

// Loads one lesson. Lessons are written in the background, so while its status is `pending` or
// `generating` we ask again every 3 seconds. The page is keyed by lessonId, so this hook starts fresh
// for every lesson.
export default function useLesson(courseId, lessonId) {
  const request = useAuthedApi()
  const [lesson, setLesson] = useState(null)
  const [error, setError] = useState(null) // the thrown error; `error.status` is the HTTP status

  const load = useCallback(async () => {
    try {
      setLesson(await request(`/courses/${courseId}/lessons/${lessonId}`))
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [request, courseId, lessonId])

  useEffect(() => {
    load()
  }, [load])

  const inProgress = lesson?.status === 'pending' || lesson?.status === 'generating'
  usePolling(load, inProgress)

  // A failed lesson: ask the server to write it again, then polling picks up the new status.
  const retry = async () => {
    try {
      await request(`/courses/${courseId}/lessons/${lessonId}/retry`, { method: 'POST' })
      setLesson((current) => ({ ...current, status: 'pending' }))
    } catch (err) {
      setError(err)
    }
  }

  return { lesson, error, reload: load, retry }
}
