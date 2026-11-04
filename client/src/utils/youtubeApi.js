const SCRIPT_URL = 'https://www.youtube.com/iframe_api'

let loading = null

// Loads YouTube's IFrame Player API once and resolves to window.YT. A failed load can be tried again.
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onerror = () => {
      script.remove()
      loading = null
      reject(new Error('The YouTube player could not be loaded.'))
    }
    document.head.appendChild(script)
  })
  return loading
}
