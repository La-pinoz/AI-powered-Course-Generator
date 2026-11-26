import useLessonAudio from '../../hooks/useLessonAudio.js'

// "Listen in Hinglish": the lesson explained in Hinglish by AI, as audio plus a written transcript.
export default function HinglishAudio({ courseId, lessonId }) {
  const { audio, audioUrl, error, start, reload } = useLessonAudio(courseId, lessonId)

  let body
  if (!audio) {
    body = (
      <>
        <p className="text-muted">{error || 'Loading…'}</p>
        {error && (
          <button type="button" className="btn btn-secondary mt-4" onClick={reload}>
            Try again
          </button>
        )}
      </>
    )
  } else if (audio.status === 'generating') {
    body = (
      <p role="status" className="text-muted">
        Making the Hinglish audio… this takes about a minute. You can keep reading.
      </p>
    )
  } else if (audio.status === 'ready') {
    body = (
      <>
        {audioUrl ? (
          <audio controls src={audioUrl} className="w-full" />
        ) : (
          <p className="text-muted">{error || 'Loading audio…'}</p>
        )}
        {audio.script?.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-medium">Show transcript</summary>
            <div className="mt-2 space-y-3 border-l-2 border-line pl-3">
              {audio.script.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </details>
        )}
      </>
    )
  } else {
    // 'none' (not made yet, or the lesson changed) or 'failed'
    body = (
      <>
        <p>
          {audio.status === 'failed'
            ? "We couldn't make the audio for this lesson."
            : 'Hear this lesson explained in simple Hinglish, like a teacher would.'}
        </p>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <button type="button" className="btn btn-primary mt-4" onClick={start}>
          {audio.status === 'failed' ? 'Try again' : 'Listen in Hinglish'}
        </button>
      </>
    )
  }

  return (
    <section className="card" aria-labelledby="hinglish-heading">
      <h2 id="hinglish-heading" className="mb-3 text-2xl font-medium">
        Hinglish audio
      </h2>
      {body}
    </section>
  )
}
