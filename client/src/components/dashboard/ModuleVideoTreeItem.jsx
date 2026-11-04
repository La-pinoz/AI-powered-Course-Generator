import { Box, Flex, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import useCourses from '../../hooks/useCourses.js'
import { moduleVideoPath } from '../../utils/courseSteps.js'
import { PlayIcon } from './icons.jsx'

// The first row of every module. Not a lesson: no number, no ✓, no count, and its look never depends
// on the search status, so showing it never starts a search.
export default function ModuleVideoTreeItem({ course, module }) {
  const { routeCourseId, routeModuleId } = useCourses()
  const isOpenPage = routeCourseId === course._id && routeModuleId === module._id

  return (
    <li>
      <Box asChild>
        <RouterLink to={moduleVideoPath(course._id, module._id)} aria-current={isOpenPage ? 'page' : undefined}>
          <Flex
            align="center"
            gap="2"
            minH={{ base: '44px', md: '36px' }}
            pl="12"
            pr="3"
            rounded="md"
            fontSize="sm"
            color={isOpenPage ? 'fg' : 'text.muted'}
            bg={isOpenPage ? 'accent.subtle' : 'transparent'}
            _hover={{ bg: isOpenPage ? 'accent.subtle' : 'bg.muted', color: 'fg' }}
            _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '-2px' }}
          >
            <Box as="span" w="4" flexShrink="0" display="inline-flex" justifyContent="center">
              <PlayIcon size="14px" />
            </Box>
            <Text as="span" truncate>
              Module video
            </Text>
          </Flex>
        </RouterLink>
      </Box>
    </li>
  )
}
