import { Box, Flex, Text, VisuallyHidden } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import useCourses from '../../hooks/useCourses.js'
import { CheckIcon } from './icons.jsx'

export default function LessonTreeItem({ course, lesson }) {
  const { getCurrentLessonId, routeCourseId, routeLessonId } = useCourses()

  const isCurrent = getCurrentLessonId(course) === lesson._id
  // `aria-current="page"` only when this lesson is the page being viewed.
  const isOpenPage = routeCourseId === course._id && routeLessonId === lesson._id

  return (
    <li>
      <Box asChild>
        <RouterLink
          to={`/courses/${course._id}/lessons/${lesson._id}`}
          aria-current={isOpenPage ? 'page' : undefined}
        >
          <Flex
            align="center"
            gap="2"
            minH={{ base: '44px', md: '36px' }}
            pl="12"
            pr="3"
            rounded="md"
            fontSize="sm"
            color={isCurrent ? 'fg' : 'text.muted'}
            bg={isCurrent ? 'accent.subtle' : 'transparent'}
            _hover={{ bg: isCurrent ? 'accent.subtle' : 'bg.muted', color: 'fg' }}
            _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '-2px' }}
          >
            <Box as="span" w="4" flexShrink="0" display="inline-flex" justifyContent="center">
              {lesson.completed && <CheckIcon size="14px" />}
            </Box>
            <Text as="span" truncate title={lesson.title}>
              L{lesson.order}: {lesson.title}
            </Text>
            {lesson.completed && <VisuallyHidden>(completed)</VisuallyHidden>}
            {isCurrent && !isOpenPage && <VisuallyHidden>(continue here)</VisuallyHidden>}
          </Flex>
        </RouterLink>
      </Box>
    </li>
  )
}
