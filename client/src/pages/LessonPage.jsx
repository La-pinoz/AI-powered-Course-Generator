import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import NotFound from '../components/NotFound.jsx'
import HinglishAudio from '../components/lesson/HinglishAudio.jsx'
import LessonPdfExporter from '../components/lesson/LessonPdfExporter.jsx'
import LessonRenderer from '../components/lesson/LessonRenderer.jsx'
import Quiz from '../components/lesson/Quiz.jsx'
import StepNav from '../components/lesson/StepNav.jsx'
import useAuthedApi from '../hooks/useAuthedApi.js'
import useCourses from '../hooks/useCourses.js'
import useLesson from '../hooks/useLesson.js'
import { courseSteps, stepsAround } from '../utils/courseSteps.js'
import { messageFor } from '../utils/errorMessage.js'

// /courses/:courseId/lessons/:lessonId
// The `key` gives every lesson a fresh component, so its state (quiz answers, audio, PDF) never leaks
// into the next lesson.
export default function LessonPage() {
  const { courseId, lessonId } = useParams()
  return <Lesson key={lessonId} courseId={courseId} lessonId={lessonId} />
}

function Lesson({ courseId, lessonId }) {
  const request = useAuthedApi()
  const { courses, outline, refreshOutline, refreshCourses } = useCourses()
  const { lesson, error, reload, retry } = useLesson(courseId, lessonId)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const ready = lesson?.status === 'ready'

  // Opening a ready lesson saves it as the course's "continue from here" point.
  useEffect(() => {
    if (!ready) return
    window.scrollTo(0, 0)
    request(`/courses/${courseId}/progress`, { method: 'PATCH', body: { lessonId, makeCurrent: true } })
      .then(refreshCourses)
      .catch(() => {}) // not important enough to show an error
  }, [ready, request, courseId, lessonId, refreshCourses])

  if (error?.status === 404) return <NotFound what="Lesson" />
  if (error) return <ErrorMessage message={messageFor(error)} onRetry={reload} />
  if (!lesson) return <LoadingSpinner label="Loading lesson…" />

  const course = courses.find((c) => c._id === courseId)
  const outlineLesson = outline?.modules.flatMap((m) => m.lessons).find((l) => l._id === lessonId)
  const completed = Boolean(outlineLesson?.completed)
  const { prev, next } = outline ? stepsAround(courseSteps(courseId, outline.modules), `lesson-${lessonId}`) : {}

  const toggleCompleted = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await request(`/courses/${courseId}/progress`, {
        method: 'PATCH',
        body: { lessonId, completed: !completed },
      })
      await Promise.all([refreshOutline(), refreshCourses()])
    } catch (err) {
      setSaveError(messageFor(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="space-y-6">
      <header className="card">
        <p className="text-sm text-muted">
          Module {lesson.moduleOrder} · {lesson.moduleTitle}
        </p>
        <h1 className="mt-1 text-3xl font-medium">
          Lesson {lesson.order}: {lesson.title}
        </h1>
        {lesson.objectives?.length > 0 && (
          <div className="mt-5">
            <p className="font-medium">In this lesson you will:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-muted">
              {lesson.objectives.map((objective, index) => (
                <li key={index}>{objective}</li>
              ))}
            </ul>
          </div>
        )}
        {ready && (
          <div className="mt-5">
            <LessonPdfExporter lesson={lesson} />
          </div>
        )}
      </header>

      {(lesson.status === 'pending' || lesson.status === 'generating') && (
        <LoadingSpinner label="Writing this lesson… this usually takes 10–30 seconds." />
      )}

      {lesson.status === 'failed' && (
        <div className="card">
          <p className="font-medium">We couldn&apos;t write this lesson.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {ready && (
        <>
          <section className="card">
            <LessonRenderer content={lesson.content} />
          </section>
          <Quiz content={lesson.content} />
          {course?.options.hinglishAudio && <HinglishAudio courseId={courseId} lessonId={lessonId} />}
        </>
      )}

      <footer className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`btn ${completed ? 'btn-secondary' : 'btn-primary'}`}
            onClick={toggleCompleted}
            disabled={!ready || !outline || saving}
          >
            {completed ? '✓ Completed (undo)' : 'Mark as completed'}
          </button>
          {saveError && <p className="text-sm text-red-700">{saveError}</p>}
        </div>
        <StepNav prev={prev} next={next} endPath={`/courses/${courseId}`} />
      </footer>
    </article>
  )
}
