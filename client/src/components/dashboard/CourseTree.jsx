import { Box, Button, Skeleton, Stack, Text } from '@chakra-ui/react'
import useCourses from '../../hooks/useCourses.js'
import CourseTreeItem from './CourseTreeItem.jsx'

export default function CourseTree() {
  const { courses, status, fetchCourses } = useCourses()

  if (status === 'loading') {
    return (
      <Stack gap="3" px="3" role="status" aria-label="Loading courses">
        <Skeleton height="5" />
        <Skeleton height="5" />
        <Skeleton height="5" />
      </Stack>
    )
  }

  if (status === 'error') {
    return (
      <Text fontSize="sm" color="text.muted" px="3">
        Couldn&apos;t load courses.{' '}
        <Button
          variant="plain"
          size="sm"
          color="accent.fg"
          px="1"
          h="auto"
          minH={{ base: '44px', md: 'auto' }}
          onClick={fetchCourses}
        >
          Retry
        </Button>
      </Text>
    )
  }

  if (courses.length === 0) {
    return (
      <Text fontSize="sm" color="text.muted" px="3">
        No courses yet
      </Text>
    )
  }

  return (
    <Box as="ul" listStyleType="none" m="0" p="0">
      {courses.map((course) => (
        <CourseTreeItem key={course._id} course={course} />
      ))}
    </Box>
  )
}
