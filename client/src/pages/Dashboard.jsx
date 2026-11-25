import CreateCourseForm from '../components/dashboard/CreateCourseForm.jsx'
import CourseCard from '../components/dashboard/CourseCard.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import useCourses from '../hooks/useCourses.js'
import { statsLine } from '../utils/format.js'

// /dashboard: create a course, then continue the ones you already have.
export default function Dashboard() {
  const { courses, coursesLoading, coursesError, refreshCourses } = useCourses()

  const stats = {
    courseCount: courses.length,
    lessonCount: courses.reduce((sum, course) => sum + course.lessonCount, 0),
    completedLessonCount: courses.reduce((sum, course) => sum + course.completedLessonCount, 0),
  }

  let list
  if (coursesLoading) {
    list = <LoadingSpinner label="Loading your courses…" />
  } else if (coursesError) {
    list = <ErrorMessage message={coursesError} onRetry={refreshCourses} />
  } else if (courses.length === 0) {
    list = <p className="text-muted">No courses yet. Enter a topic above to generate your first one.</p>
  } else {
    list = (
      <div className="grid gap-4 lg:grid-cols-2">
        {courses.map((course) => (
          <CourseCard key={course._id} course={course} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <CreateCourseForm />

      <section className="card" aria-labelledby="continue-heading">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="continue-heading" className="text-2xl font-medium">
            Continue learning
          </h2>
          {courses.length > 0 && <p className="text-sm text-muted">{statsLine(stats)}</p>}
        </div>
        {list}
      </section>
    </div>
  )
}
