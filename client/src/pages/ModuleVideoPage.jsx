import { Link, useParams } from 'react-router-dom'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import NotFound from '../components/NotFound.jsx'
import StepNav from '../components/lesson/StepNav.jsx'
import useCourses from '../hooks/useCourses.js'
import useModuleVideo from '../hooks/useModuleVideo.js'
import { courseSteps, lessonPath, stepsAround } from '../utils/courseSteps.js'
import { messageFor } from '../utils/errorMessage.js'

// /courses/:courseId/modules/:moduleId/video
// A YouTube video picked for the module. Keyed by moduleId so each module starts with fresh state.
export default function ModuleVideoPage() {
  const { courseId, moduleId } = useParams()
  return <ModuleVideo key={moduleId} courseId={courseId} moduleId={moduleId} />
}

function ModuleVideo({ courseId, moduleId }) {
  const { outline } = useCourses()
  const { video, error, reload, retry, selectVideo, reportUnavailable } = useModuleVideo(courseId, moduleId)

  if (error?.status === 404) return <NotFound what="Module" />

  const module = outline?.modules.find((m) => m._id === moduleId)
  const firstLesson = module?.lessons[0]
  const { prev } = outline ? stepsAround(courseSteps(courseId, outline.modules), `video-${moduleId}`) : {}

  const approved = video?.approved ?? []
  const selectedIndex = approved.findIndex((v) => v.videoId === video?.selectedVideoId)
  const selected = approved[selectedIndex]
  const nextVideo = approved.length > 1 ? approved[(selectedIndex + 1) % approved.length] : null

  let body
  if (error) {
    // 429 (daily limit) and 503 (YouTube unavailable) come with a readable message from the server.
    body = <ErrorMessage message={messageFor(error)} onRetry={reload} />
  } else if (!video) {
    body = <LoadingSpinner label="Loading video…" />
  } else if (video.status === 'searching') {
    body = <LoadingSpinner label="Finding a video for this module… this usually takes 10–30 seconds." />
  } else if (video.status === 'ready' && selected) {
    body = (
      <>
        <iframe
          className="aspect-video w-full rounded-2xl bg-black"
          src={`https://www.youtube-nocookie.com/embed/${selected.videoId}?rel=0`}
          title={`YouTube video: ${selected.title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <p className="mt-4 font-medium">{selected.title}</p>
        <p className="text-sm text-muted">{selected.channelTitle} · YouTube</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {nextVideo && (
            <button type="button" className="btn btn-secondary" onClick={() => selectVideo(nextVideo.videoId)}>
              Show another video
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => reportUnavailable(selected.videoId)}>
            Video not working? Try the next one
          </button>
        </div>
      </>
    )
  } else {
    // 'none' or 'failed'
    const canTryAgain = video.status === 'failed' || video.canSearchAgain
    body = (
      <div className="card">
        <p className="font-medium">
          {video.status === 'failed' ? "We couldn't find a video right now." : 'No suitable video found for this module.'}
        </p>
        {canTryAgain && (
          <button type="button" className="btn btn-secondary mt-4" onClick={retry}>
            Search again
          </button>
        )}
      </div>
    )
  }

  return (
    <article className="space-y-6">
      <header>
        <p className="text-sm text-muted">Module {module?.order} video</p>
        <h1 className="mt-1 text-3xl font-medium">{module?.title ?? 'Module video'}</h1>
      </header>

      {body}

      {firstLesson && (
        <Link to={lessonPath(courseId, firstLesson._id)} className="btn btn-primary">
          Start Lesson 1 →
        </Link>
      )}

      <StepNav prev={prev} next={null} />
    </article>
  )
}
