import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Heading, Text } from '@chakra-ui/react'
import PillButton from '../components/dashboard/PillButton.jsx'
import useCourses from '../hooks/useCourses.js'

// Stand-in so the post-generation redirect and the sidebar lesson links have somewhere to land.
// The real course and lesson pages come in a later spec.
export default function CoursePlaceholder() {
  const { courseId, lessonId } = useParams()
  const { courses, status, outlines, fetchOutline } = useCourses()

  useEffect(() => {
    fetchOutline(courseId)
  }, [courseId, fetchOutline])

  const course = courses.find((c) => c._id === courseId)
  const outline = outlines[courseId]
  const lesson =
    lessonId && outline?.status === 'ready'
      ? outline.data.modules.flatMap((m) => m.lessons).find((l) => l._id === lessonId)
      : null

  const notFound = status === 'ready' && !course

  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="2xl"
      p={{ base: '5', md: '8' }}
    >
      {notFound ? (
        <Heading as="h2" size="xl" fontWeight="medium" letterSpacing="tight">
          Course not found
        </Heading>
      ) : (
        <Heading as="h2" size="xl" fontWeight="medium" letterSpacing="tight">
          {lesson?.title ?? course?.title ?? 'Loading…'}
        </Heading>
      )}
      {!notFound && (
        <Text mt="2" color="text.muted">
          Lesson pages are coming soon.
        </Text>
      )}
      <PillButton to="/dashboard" mt="6">
        Back to dashboard
      </PillButton>
    </Box>
  )
}
