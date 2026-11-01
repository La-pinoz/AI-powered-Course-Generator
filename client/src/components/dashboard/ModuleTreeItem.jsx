import { Box, Collapsible, Text } from '@chakra-ui/react'
import useCourses from '../../hooks/useCourses.js'
import { ChevronDownIcon, ChevronRightIcon } from './icons.jsx'
import LessonTreeItem from './LessonTreeItem.jsx'

export default function ModuleTreeItem({ course, module }) {
  const { expandedModules, toggleModule } = useCourses()
  const expanded = expandedModules.has(module._id)

  return (
    <li>
      <Collapsible.Root open={expanded} onOpenChange={() => toggleModule(module._id)} lazyMount unmountOnExit>
        <Collapsible.Trigger
          w="full"
          display="flex"
          alignItems="center"
          gap="2"
          minH={{ base: '44px', md: '36px' }}
          pl="6"
          pr="3"
          rounded="md"
          textAlign="start"
          fontSize="sm"
          color="text.muted"
          cursor="pointer"
          _hover={{ bg: 'bg.muted', color: 'fg' }}
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '-2px' }}
        >
          <Box as="span" flexShrink="0" display="inline-flex">
            {expanded ? <ChevronDownIcon size="14px" /> : <ChevronRightIcon size="14px" />}
          </Box>
          <Text as="span" truncate title={`Module ${module.order}: ${module.title}`}>
            Module {module.order}: {module.title}
          </Text>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <Box as="ul" listStyleType="none" m="0" p="0">
            {module.lessons.map((lesson) => (
              <LessonTreeItem key={lesson._id} course={course} lesson={lesson} />
            ))}
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </li>
  )
}
