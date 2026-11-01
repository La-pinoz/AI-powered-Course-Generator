import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Flex, Heading, LinkBox, LinkOverlay, Progress, Text } from '@chakra-ui/react'
import { courseMeta } from '../../utils/format.js'
import CourseCardMenu from './CourseCardMenu.jsx'
import DeleteCourseDialog from './DeleteCourseDialog.jsx'

export default function CourseCard({ course, onDeleted }) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Resume point, or the course page if it has none.
  const href = course.currentLessonId
    ? `/courses/${course._id}/lessons/${course.currentLessonId}`
    : `/courses/${course._id}`

  return (
    <LinkBox
      as="article"
      p="5"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="xl"
      _hover={{ borderColor: 'accent' }}
    >
      <Flex align="flex-start" justify="space-between" gap="3">
        <Heading as="h3" size="lg" fontWeight="medium" letterSpacing="tight" flex="1" minW="0" truncate>
          <LinkOverlay
            asChild
            _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '4px' }}
          >
            <RouterLink to={href} title={course.title}>
              {course.title}
            </RouterLink>
          </LinkOverlay>
        </Heading>
        <CourseCardMenu course={course} onDelete={() => setConfirmOpen(true)} />
      </Flex>

      <Text mt="1" fontSize="sm" color="text.muted">
        {courseMeta(course)}
      </Text>

      <Progress.Root
        mt="4"
        value={course.completedLessonCount}
        min={0}
        max={course.lessonCount}
        size="sm"
      >
        {/* The progressbar role lives on the Track part, so the accessible name goes here. */}
        <Progress.Track bg="bg.muted" aria-label={`${course.title} progress`}>
          <Progress.Range bg="success" />
        </Progress.Track>
      </Progress.Root>
      <Text mt="3" fontSize="sm" color="text.muted">
        {course.completedLessonCount}/{course.lessonCount} lessons completed
      </Text>

      <DeleteCourseDialog
        course={course}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDeleted={onDeleted}
      />
    </LinkBox>
  )
}
