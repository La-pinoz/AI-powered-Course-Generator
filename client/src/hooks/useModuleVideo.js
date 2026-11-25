import { useCallback, useEffect, useState } from 'react'
import useAuthedApi from './useAuthedApi.js'
import usePolling from './usePolling.js'

// The YouTube video of one module. The first visit makes the server search for one, so while the
// status is `searching` we ask again every 3 seconds.
// `video` is the server's answer: { status, approved: [{ videoId, title, channelTitle }],
// selectedVideoId, canSearchAgain, error }. Status: 'searching' | 'ready' | 'none' | 'failed'.
export default function useModuleVideo(courseId, moduleId) {
  const request = useAuthedApi()
  const path = `/courses/${courseId}/modules/${moduleId}/video`

  const [video, setVideo] = useState(null)
  const [error, setError] = useState(null) // the thrown error; `error.status` is the HTTP status

  const load = useCallback(async () => {
    try {
      setVideo(await request(path))
      setError(null)
    } catch (err) {
      setError(err)
    }
  }, [request, path])

  useEffect(() => {
    load()
  }, [load])

  usePolling(load, video?.status === 'searching')

  // Every action below returns the module's new video state from the server.
  const send = async (subPath, method, body) => {
    try {
      setVideo(await request(`${path}${subPath}`, { method, body }))
      setError(null)
    } catch (err) {
      setError(err)
    }
  }

  return {
    video,
    error,
    reload: load,
    // Search again after `none` / `failed`. The server answers right away with `searching`.
    retry: () => send('/retry', 'POST'),
    // Show another of the approved videos.
    selectVideo: (videoId) => send('', 'PATCH', { videoId }),
    // The user says this video doesn't play; the server removes it and picks the next one.
    reportUnavailable: (videoId) => send('/report-unavailable', 'POST', { videoId }),
  }
}
