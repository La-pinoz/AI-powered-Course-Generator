import { useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Stack } from '@chakra-ui/react'
import useCourses from '../hooks/useCourses.js'
import useLesson from '../hooks/useLesson.js'
import LessonHeader from '../components/lesson/LessonHeader.jsx'
import LessonSection from '../components/lesson/LessonSection.jsx'
import LessonFooter from '../components/lesson/LessonFooter.jsx'
import LessonSkeleton from '../components/lesson/LessonSkeleton.jsx'
import LessonStatusCard from '../components/lesson/LessonStatusCard.jsx'
import { lessonSections } from '../components/lesson/lessonSections.js'
import { courseSteps, stepsAround } from '../utils/courseSteps.js'

// /courses/:courseId/lessons/:lessonId. Title and objectives show as soon as the server answers, even
// while the lesson is still being written; the sections appear once its content is ready.
export default function LessonPage() {
  const { courseId, lessonId } = useParams()
  const { courses, status: coursesStatus, outlines, fetchOutline, setLessonCompleted, setCurrentLesson } =
    useCourses()
  const { status, lesson, error, retry, reload } = useLesson(courseId, lessonId)
  const headingRef = useRef(null)

  useEffect(() => {
    fetchOutline(courseId)
  }, [courseId, fetchOutline])

  const course = courses.find((c) => c._id === courseId)
  const outline = outlines[courseId]
  const outlineReady = outline?.status === 'ready'

  // This lesson, and Previous / Next through the module videos and lessons, from the cached outline.
  const { current, prev, next } = useMemo(() => {
    if (!outlineReady) return { current: null, prev: null, next: null }
    const { modules } = outline.data
    return {
      current: modules.flatMap((m) => m.lessons).find((l) => l._id === lessonId) ?? null,
      ...stepsAround(courseSteps(courseId, modules), `lesson-${lessonId}`),
    }
  }, [outlineReady, outline, courseId, lessonId])

  // New lesson: back to the top, and focus its heading once it has rendered (a lesson change doesn't
  // reload the page, so keyboard and screen-reader users would otherwise stay where they were).
  const focusedFor = useRef(null)
  useEffect(() => {
    if (lesson?.id !== lessonId || focusedFor.current === lessonId) return
    focusedFor.current = lessonId
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [lesson?.id, lessonId])

  // Opening a ready lesson makes it the resume point for Continue Learning.
  const madeCurrent = useRef(null)
  const currentLessonId = course?.currentLessonId
  useEffect(() => {
    if (status !== 'ready' || !course || madeCurrent.current === lessonId) return
    madeCurrent.current = lessonId
    if (currentLessonId !== lessonId) setCurrentLesson(courseId, lessonId)
  }, [status, course, currentLessonId, courseId, lessonId, setCurrentLesson])

  const courseMissing = coursesStatus === 'ready' && !course
  const visibleSections = course
    ? lessonSections.filter((section) => section.isVisible({ lesson, course }))
    : []

  let body
  if (status === 'notFound' || courseMissing) {
    body = <LessonStatusCard kind="notFound" />
  } else if (status === 'error') {
    body = <LessonStatusCard kind="error" message={error} onRetry={reload} />
  } else if (status === 'loading' || !lesson || (status === 'ready' && !course)) {
    body = <LessonSkeleton />
  } else {
    body = (
      <>
        <LessonHeader lesson={lesson} headingRef={headingRef} />
        <Box mt="8">
          {status === 'ready' && (
            <Stack gap="3">
              {visibleSections.map((section) => (
                // Keyed by lesson so open/closed state and quiz answers reset on lesson change.
                <LessonSection key={`${lesson.id}-${section.id}`} section={section} lesson={lesson} course={course} />
              ))}
            </Stack>
          )}
          {(status === 'pending' || status === 'generating') && <LessonStatusCard kind="preparing" />}
          {status === 'failed' && <LessonStatusCard kind="failed" onRetry={retry} />}
        </Box>
        <LessonFooter
          completed={Boolean(current?.completed)}
          canComplete={status === 'ready' && outlineReady}
          onToggleComplete={(completed) => setLessonCompleted(courseId, lessonId, completed)}
          prev={prev}
          next={next}
        />
      </>
    )
  }

  return (
    <Box maxW="760px" mx="auto" pb="8">
      {body}
    </Box>
  )
}
