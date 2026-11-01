import { useRef } from 'react'
import { Box, Button, Flex, Heading, SimpleGrid, Skeleton, Text } from '@chakra-ui/react'
import useCourses from '../../hooks/useCourses.js'
import { statsLine } from '../../utils/format.js'
import CourseCard from './CourseCard.jsx'
import EmptyCourses from './EmptyCourses.jsx'

export default function ContinueLearning() {
  const { courses, stats, status, error, fetchCourses } = useCourses()
  const headingRef = useRef(null)

  // A deleted card takes its ⋯ button (the dialog's focus target) with it, so land on the heading.
  // Delayed so it runs after the dialog has finished unmounting.
  const focusHeading = () => setTimeout(() => headingRef.current?.focus(), 100)

  return (
    <Box
      as="section"
      aria-labelledby="continue-learning-heading"
      mt="8"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="2xl"
      p={{ base: '4', md: '8' }}
    >
      <Flex align="baseline" justify="space-between" wrap="wrap" columnGap="6" rowGap="1" mb="6">
        <Heading
          as="h2"
          id="continue-learning-heading"
          ref={headingRef}
          tabIndex={-1}
          size="2xl"
          fontWeight="medium"
          letterSpacing="tight"
          _focusVisible={{ outline: 'none' }}
        >
          Continue Learning
        </Heading>
        {status === 'ready' && courses.length > 0 && (
          <Text color="text.muted">{statsLine(stats)}</Text>
        )}
      </Flex>

      {status === 'loading' && (
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6" role="status" aria-label="Loading courses">
          <Skeleton height="40" rounded="xl" />
          <Skeleton height="40" rounded="xl" />
        </SimpleGrid>
      )}

      {status === 'error' && (
        <Box role="alert" p="4" rounded="lg" bg="danger.bg" color="danger.fg">
          <Text>{error || 'Could not load your courses.'}</Text>
          <Button
            mt="3"
            size="sm"
            variant="outline"
            color="fg"
            borderColor="danger.fg"
            minH={{ base: '44px', md: '32px' }}
            onClick={fetchCourses}
          >
            Try again
          </Button>
        </Box>
      )}

      {status === 'ready' && courses.length === 0 && <EmptyCourses />}

      {status === 'ready' && courses.length > 0 && (
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6">
          {courses.map((course) => (
            <CourseCard key={course._id} course={course} onDeleted={focusHeading} />
          ))}
        </SimpleGrid>
      )}
    </Box>
  )
}
