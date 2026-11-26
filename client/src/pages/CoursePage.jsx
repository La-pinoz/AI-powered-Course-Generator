import { Link } from 'react-router-dom'
import ChipList from '../components/ChipList.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import NotFound from '../components/NotFound.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import useCourses from '../hooks/useCourses.js'
import { lessonPath, moduleVideoPath } from '../utils/courseSteps.js'

const STATUS_TEXT = {
  pending: 'Waiting to be written',
  generating: 'Being written…',
  failed: 'Failed. Open it to retry',
}

// /courses/:courseId: the course syllabus. Each module with its video and its lessons.
export default function CoursePage() {
  const { courseId, outline, outlineError, refreshOutline } = useCourses()

  if (outlineError?.notFound) return <NotFound what="Course" />
  if (outlineError) return <ErrorMessage message={outlineError.message} onRetry={refreshOutline} />
  if (!outline) return <LoadingSpinner label="Loading course…" />

  const lessons = outline.modules.flatMap((module) => module.lessons)
  const completedCount = lessons.filter((lesson) => lesson.completed).length
  const resumeLessonId = outline.currentLessonId ?? lessons[0]?._id

  return (
    <div className="space-y-6">
      <header className="card">
        <h1 className="text-3xl font-medium">{outline.title}</h1>
        {outline.description && <p className="mt-3 leading-relaxed">{outline.description}</p>}
        <ChipList items={outline.tags} label="Course tags" className="mt-3" />
        <p className="mt-2 text-muted">
          {outline.modules.length} modules · {lessons.length} lessons
        </p>

        <ProgressBar className="mt-5" value={completedCount} max={lessons.length} label="Course progress" />
        <p className="mt-2 text-sm text-muted">
          {completedCount}/{lessons.length} lessons completed
          {outline.lessonsReady < outline.lessonsTotal &&
            ` · ${outline.lessonsReady} of ${outline.lessonsTotal} lessons written so far`}
        </p>

        {resumeLessonId && (
          <Link to={lessonPath(courseId, resumeLessonId)} className="btn btn-primary mt-5">
            {completedCount > 0 ? 'Continue learning' : 'Start course'}
          </Link>
        )}
      </header>

      {outline.modules.map((module) => (
        <section key={module._id} className="card" aria-labelledby={`module-${module._id}`}>
          <p className="text-sm text-muted">Module {module.order}</p>
          <h2 id={`module-${module._id}`} className="text-xl font-medium">
            {module.title}
          </h2>

          <ul className="mt-4 divide-y divide-line">
            <li>
              <Link to={moduleVideoPath(courseId, module._id)} className="flex items-center gap-3 py-3 hover:text-brand">
                <span className="w-5 text-accent">▶</span>
                Module video
              </Link>
            </li>
            {module.lessons.map((lesson) => (
              <li key={lesson._id}>
                <Link to={lessonPath(courseId, lesson._id)} className="flex items-center gap-3 py-3 hover:text-brand">
                  <span className="w-5 text-success">{lesson.completed ? '✓' : ''}</span>
                  <span className="flex-1">
                    Lesson {lesson.order}: {lesson.title}
                  </span>
                  {STATUS_TEXT[lesson.status] && (
                    <span className="text-sm text-muted">{STATUS_TEXT[lesson.status]}</span>
                  )}
                </Link>
                {/* Outside the link, so screen readers announce it as its own list. */}
                <ChipList items={lesson.keyTopics} label="Key topics" className="pb-3 pl-8" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
