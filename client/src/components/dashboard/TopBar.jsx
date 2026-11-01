import { Box, Flex, Heading, IconButton } from '@chakra-ui/react'
import useCourses from '../../hooks/useCourses.js'
import { MenuIcon } from './icons.jsx'
import UserMenu from './UserMenu.jsx'

export default function TopBar({ user, onOpenMenu, menuButtonRef }) {
  const { courses, routeCourseId } = useCourses()

  // "Dashboard" on the dashboard; the course title on course routes.
  const title = routeCourseId
    ? (courses.find((c) => c._id === routeCourseId)?.title ?? 'Course')
    : 'Dashboard'

  return (
    <Box
      as="header"
      position="sticky"
      top="0"
      zIndex="sticky"
      bg="bg.app"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Flex align="center" gap="3" minH="72px" px={{ base: '4', md: '8' }}>
        <IconButton
          ref={menuButtonRef}
          hideFrom="md"
          variant="ghost"
          size="lg"
          aria-label="Open navigation"
          onClick={onOpenMenu}
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
        >
          <MenuIcon size="22px" />
        </IconButton>
        <Heading
          as="h1"
          size={{ base: 'xl', md: '3xl' }}
          fontWeight="medium"
          letterSpacing="tight"
          flex="1"
          minW="0"
          truncate
        >
          {title}
        </Heading>
        <UserMenu user={user} />
      </Flex>
    </Box>
  )
}
