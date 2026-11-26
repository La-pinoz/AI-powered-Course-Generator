import { useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthedApi from '../../hooks/useAuthedApi.js'
import useCourses from '../../hooks/useCourses.js'
import { courseMeta } from '../../utils/format.js'
import { messageFor } from '../../utils/errorMessage.js'
import ChipList from '../ChipList.jsx'
import ProgressBar from '../ProgressBar.jsx'

// One course in the Continue Learning list: title, tags, progress, Continue and Delete.
export default function CourseCard({ course }) {
  const request = useAuthedApi()
  const { refreshCourses } = useCourses()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Continue from the last opened lesson, or open the course page.
  const continueLink = course.currentLessonId
    ? `/courses/${course._id}/lessons/${course.currentLessonId}`
    : `/courses/${course._id}`

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${course.title}"? All its modules, lessons and progress will be permanently deleted.`,
    )
    if (!confirmed) return

    setDeleting(true)
    setError('')
    try {
      await request(`/courses/${course._id}`, { method: 'DELETE' })
      await refreshCourses()
    } catch (err) {
      setError(messageFor(err))
      setDeleting(false)
    }
  }

  return (
    <article className="rounded-xl border border-line bg-white p-5">
      <h3 className="truncate text-lg font-medium">
        <Link to={`/courses/${course._id}`} className="hover:underline" title={course.title}>
          {course.title}
        </Link>
      </h3>
      <ChipList items={course.tags} label="Course tags" max={3} className="mt-2" />
      <p className="mt-1 text-sm text-muted">{courseMeta(course)}</p>

      <ProgressBar
        className="mt-4"
        value={course.completedLessonCount}
        max={course.lessonCount}
        label={`${course.title} progress`}
      />
      <p className="mt-2 text-sm text-muted">
        {course.completedLessonCount}/{course.lessonCount} lessons completed
      </p>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex gap-3">
        <Link to={continueLink} className="btn btn-primary">
          Continue
        </Link>
        <button type="button" className="btn btn-secondary text-red-700" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </article>
  )
}
