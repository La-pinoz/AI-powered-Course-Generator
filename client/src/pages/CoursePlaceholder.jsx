import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Heading, Text } from '@chakra-ui/react'
import PillButton from '../components/dashboard/PillButton.jsx'
import useCourses from '../hooks/useCourses.js'

// Stand-in for the course page (/courses/:courseId), which comes in a later spec.
// Lessons have their own page (LessonPage).
export default function CoursePlaceholder() {
  const { courseId } = useParams()
  const { courses, status, fetchOutline } = useCourses()

  useEffect(() => {
    fetchOutline(courseId)
  }, [courseId, fetchOutline])

  const course = courses.find((c) => c._id === courseId)
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
          {course?.title ?? 'Loading…'}
        </Heading>
      )}
      {!notFound && (
        <Text mt="2" color="text.muted">
          The course page is coming soon.
        </Text>
      )}
      <PillButton to="/dashboard" mt="6">
        Back to dashboard
      </PillButton>
    </Box>
  )
}
