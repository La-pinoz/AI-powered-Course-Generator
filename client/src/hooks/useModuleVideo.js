import { useCallback, useEffect, useState } from 'react'
import useAuthedApi from './useAuthedApi.js'
import { messageFor } from '../utils/errorMessage.js'

const POLL_MS = 3000

const stateFor = (moduleId, body) => ({
  moduleId,
  status: body.status,
  approved: body.approved ?? [],
  selectedVideoId: body.selectedVideoId ?? null,
  canSearchAgain: Boolean(body.canSearchAgain),
  error: body.error ?? null,
})

const errorState = (moduleId, status, error) => ({
  moduleId,
  status,
  approved: [],
  selectedVideoId: null,
  canSearchAgain: false,
  error,
})

// 429 is the daily cap, 503 is the service being unavailable, 404 is a missing or foreign module.
const stateForError = (moduleId, err) => {
  if (err?.status === 404) return errorState(moduleId, 'notFound', null)
  if (err?.status === 429) return errorState(moduleId, 'limit', messageFor(err))
  if (err?.status === 503) return errorState(moduleId, 'unavailable', messageFor(err))
  return errorState(moduleId, 'error', messageFor(err))
}

// Loads one module's video and polls every 3 s while the server is searching (paused while the tab is
// hidden). Status is 'loading' | 'searching' | 'ready' | 'none' | 'failed' | 'limit' | 'unavailable' |
// 'notFound' | 'error'. Not cached, so each open lets the server run its 7-day check.
export default function useModuleVideo(courseId, moduleId) {
  const request = useAuthedApi()
  const [state, setState] = useState(() => errorState(null, 'loading', null))
  const [reloadTick, setReloadTick] = useState(0)

  const videoUrl = `/courses/${courseId}/modules/${moduleId}/video`

  useEffect(() => {
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
        const body = await request(videoUrl, { signal })
        if (signal.aborted) return
        setState(stateFor(moduleId, body))
        if (body.status === 'searching') schedule()
      } catch (err) {
        if (signal.aborted || err?.name === 'AbortError') return
        setState(stateForError(moduleId, err))
      }
    }

    load()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [moduleId, videoUrl, reloadTick, request])

  const reload = useCallback(() => {
    setState(errorState(null, 'loading', null))
    setReloadTick((tick) => tick + 1)
  }, [])

  // Try again and Search again: asks the server, then goes back to loading and polling.
  const retry = useCallback(async () => {
    setState(errorState(moduleId, 'searching', null))
    try {
      await request(`${videoUrl}/retry`, { method: 'POST' })
    } catch (err) {
      setState(stateForError(moduleId, err))
      return
    }
    setReloadTick((tick) => tick + 1)
  }, [request, videoUrl, moduleId])

  // Show another video. Rejects on failure, so the page can keep the current video and say so.
  const selectVideo = useCallback(
    async (videoId) => {
      const body = await request(videoUrl, { method: 'PATCH', body: { videoId } })
      setState(stateFor(moduleId, body))
    },
    [request, videoUrl, moduleId],
  )

  // A player error: the server drops the video and answers with what to show next.
  const reportUnavailable = useCallback(
    async (videoId) => {
      const body = await request(`${videoUrl}/report-unavailable`, { method: 'POST', body: { videoId } })
      setState(stateFor(moduleId, body))
      return body
    },
    [request, videoUrl, moduleId],
  )

  const current = state.moduleId === moduleId ? state : errorState(moduleId, 'loading', null)
  return { ...current, retry, selectVideo, reportUnavailable, reload }
}
