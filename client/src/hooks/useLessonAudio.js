import { useCallback, useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import useAuthedApi from './useAuthedApi.js'
import usePolling from './usePolling.js'
import { apiRequestBlob } from '../utils/api.js'
import { messageFor } from '../utils/errorMessage.js'

// The Hinglish audio of one lesson.
// `audio.status` is 'none' | 'generating' | 'ready' | 'failed' (from the server), or null while loading.
// Nothing is generated until start() is called. When the audio is ready we download the MP3 with the
// access token and give the <audio> element a local blob URL, because <audio src> can't send a token.
export default function useLessonAudio(courseId, lessonId) {
  const request = useAuthedApi()
  const { getAccessTokenSilently } = useAuth0()
  const path = `/courses/${courseId}/lessons/${lessonId}/audio`

  const [audio, setAudio] = useState(null) // { status, script, error, outdated }
  const [audioUrl, setAudioUrl] = useState(null)
  const [error, setError] = useState('')

  const loadStatus = useCallback(async () => {
    try {
      setAudio(await request(path))
    } catch (err) {
      setError(messageFor(err))
    }
  }, [request, path])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  usePolling(loadStatus, audio?.status === 'generating')

  // Once the audio is ready, download the MP3. The blob URL is released when we leave the lesson.
  const ready = audio?.status === 'ready'
  useEffect(() => {
    if (!ready) return undefined
    let url = null
    let cancelled = false

    const download = async () => {
      try {
        const token = await getAccessTokenSilently()
        const blob = await apiRequestBlob(`${path}/file`, { token })
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setAudioUrl(url)
      } catch (err) {
        if (!cancelled) setError(messageFor(err))
      }
    }
    download()

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [ready, path, getAccessTokenSilently])

  // "Listen in Hinglish" (and Try again). 429 means the daily limit is reached.
  const start = async () => {
    setError('')
    try {
      setAudio(await request(path, { method: 'POST' }))
    } catch (err) {
      setError(messageFor(err))
    }
  }

  return { audio, audioUrl, error, start }
}
