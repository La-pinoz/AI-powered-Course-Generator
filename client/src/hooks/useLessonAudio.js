import { useCallback, useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import useAuthedApi from './useAuthedApi.js'
import { apiRequestBlob } from '../utils/api.js'
import { messageFor } from '../utils/errorMessage.js'

const POLL_MS = 3000

const INITIAL = { status: 'loading', stage: null, outdated: false, durationSec: null, script: [], error: null }
const NO_FILE = { key: null, status: 'idle', url: null, error: null }

// The Hinglish audio of one lesson (Spec 6). Mounting only reads the status; nothing is generated
// until start() is called. While the server is generating, it polls every 3 s (paused while the tab
// is hidden). When the audio is ready it fetches the MP3 as a blob (an <audio src> can't send the
// bearer token) and exposes an object URL, revoked on unmount.
//
// status: 'loading' | 'none' | 'generating' | 'ready' | 'failed' | 'limit' | 'error'
// file.status: 'idle' | 'loading' | 'ready' | 'error'
export default function useLessonAudio(courseId, lessonId) {
  const request = useAuthedApi()
  const { getAccessTokenSilently } = useAuth0()
  const base = `/courses/${courseId}/lessons/${lessonId}/audio`

  const [audio, setAudio] = useState(INITIAL)
  const [file, setFile] = useState(NO_FILE)
  const [starting, setStarting] = useState(false)
  const [pollTick, setPollTick] = useState(0) // bumping it (re)starts the status loop
  const [fileTick, setFileTick] = useState(0)

  const apply = useCallback((body) => {
    setAudio({
      status: body.status,
      stage: body.stage ?? null,
      outdated: Boolean(body.outdated),
      durationSec: body.durationSec ?? null,
      script: body.script ?? [],
      error: body.error ?? null,
    })
  }, [])

  // Status, and polling while generating.
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
        const body = await request(base, { signal })
        if (signal.aborted) return
        apply(body)
        if (body.status === 'generating') schedule()
      } catch (err) {
        if (signal.aborted || err?.name === 'AbortError') return
        setAudio((prev) => ({ ...prev, status: 'error', error: messageFor(err) }))
      }
    }

    load()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [base, request, apply, pollTick])

  // The MP3, once the audio is ready.
  // The result is tagged with the request it belongs to, so a new fetch reads as 'loading' without
  // a synchronous setState in the effect.
  const ready = audio.status === 'ready'
  const fileKey = `${base}#${fileTick}`
  useEffect(() => {
    if (!ready) return undefined
    const controller = new AbortController()
    let url = null

    ;(async () => {
      try {
        const token = await getAccessTokenSilently()
        const blob = await apiRequestBlob(`${base}/file`, { token, signal: controller.signal })
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setFile({ key: fileKey, status: 'ready', url, error: null })
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return
        setFile({ key: fileKey, status: 'error', url: null, error: messageFor(err) })
      }
    })()

    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [ready, base, fileKey, getAccessTokenSilently])

  let currentFile = NO_FILE
  if (ready) currentFile = file.key === fileKey ? file : { status: 'loading', url: null, error: null }

  // Starts generation (also the Retry). The server answers 200 with ready audio (no Gemini call)
  // or 202 while generating; 429 is the daily limit.
  const start = useCallback(async () => {
    setStarting(true)
    try {
      const body = await request(base, { method: 'POST' })
      apply(body)
      if (body.status === 'generating') setPollTick((tick) => tick + 1)
    } catch (err) {
      if (err?.status === 429) setAudio((prev) => ({ ...prev, status: 'limit', error: err.message }))
      else setAudio((prev) => ({ ...prev, status: 'error', error: messageFor(err) }))
    } finally {
      setStarting(false)
    }
  }, [request, base, apply])

  // Re-reads the status after a request error (does not regenerate).
  const reload = useCallback(() => {
    setAudio(INITIAL)
    setPollTick((tick) => tick + 1)
  }, [])

  // Fetches the MP3 again after a playback or download error (does not regenerate).
  const reloadFile = useCallback(() => setFileTick((tick) => tick + 1), [])

  return { ...audio, file: currentFile, starting, start, retry: start, reload, reloadFile }
}
