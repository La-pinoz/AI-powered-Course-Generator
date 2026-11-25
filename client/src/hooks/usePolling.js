import { useEffect } from 'react'

// Calls `callback` every `intervalMs` while `enabled` is true. Used while the server is still working
// in the background (writing a lesson, making audio, finding a video). Wrap `callback` in useCallback,
// otherwise the timer restarts on every render.
export default function usePolling(callback, enabled, intervalMs = 3000) {
  useEffect(() => {
    if (!enabled) return undefined
    const timer = setInterval(callback, intervalMs)
    return () => clearInterval(timer)
  }, [callback, enabled, intervalMs])
}
