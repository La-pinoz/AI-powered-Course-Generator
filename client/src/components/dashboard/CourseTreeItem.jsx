import { Box, Button, Collapsible, Skeleton, Stack, Text } from '@chakra-ui/react'
import useCourses from '../../hooks/useCourses.js'
import { BookIcon, ChevronDownIcon, ChevronRightIcon } from './icons.jsx'
import ModuleTreeItem from './ModuleTreeItem.jsx'

export default function CourseTreeItem({ course }) {
  const { expandedCourses, toggleCourse, outlines, fetchOutline } = useCourses()
  const expanded = expandedCourses.has(course._id)
  const outline = outlines[course._id]

  return (
    <li>
      <Collapsible.Root open={expanded} onOpenChange={() => toggleCourse(course._id)} lazyMount unmountOnExit>
        <Collapsible.Trigger
          w="full"
          display="flex"
          alignItems="center"
          gap="2"
          minH={{ base: '44px', md: '40px' }}
          px="3"
          rounded="md"
          textAlign="start"
          fontWeight="medium"
          cursor="pointer"
          _hover={{ bg: 'bg.muted' }}
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '-2px' }}
        >
          <Box as="span" flexShrink="0" display="inline-flex" color="text.muted">
            {expanded ? <ChevronDownIcon size="14px" /> : <ChevronRightIcon size="14px" />}
          </Box>
          <Box as="span" flexShrink="0" display="inline-flex" color="accent">
            <BookIcon size="16px" />
          </Box>
          <Text as="span" truncate title={course.title}>
            {course.title}
          </Text>
        </Collapsible.Trigger>

        <Collapsible.Content>
          {(!outline || outline.status === 'loading') && (
            <Stack gap="2" pl="6" pr="3" py="2" role="status" aria-label="Loading modules">
              <Skeleton height="4" />
              <Skeleton height="4" />
              <Skeleton height="4" />
            </Stack>
          )}

          {outline?.status === 'error' && (
            <Text fontSize="sm" color="text.muted" pl="6" pr="3" py="2">
              Couldn&apos;t load modules.{' '}
              <Button
                variant="plain"
                size="sm"
                color="accent.fg"
                px="1"
                h="auto"
                minH={{ base: '44px', md: 'auto' }}
                onClick={() => fetchOutline(course._id)}
              >
                Retry
              </Button>
            </Text>
          )}

          {outline?.status === 'ready' && (
            <Box as="ul" listStyleType="none" m="0" p="0">
              {outline.data.modules.map((module) => (
                <ModuleTreeItem key={module._id} course={course} module={module} />
              ))}
            </Box>
          )}
        </Collapsible.Content>
      </Collapsible.Root>
    </li>
  )
}
