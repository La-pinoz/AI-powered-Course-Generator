import { Box, Flex, Text } from '@chakra-ui/react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import CourseTree from './CourseTree.jsx'
import { HomeIcon } from './icons.jsx'

const focusRing = { outline: '2px solid', outlineColor: 'accent', outlineOffset: '-2px' }

// Header and Dashboard link stay fixed; only the course list scrolls.
export default function Sidebar() {
  const { pathname } = useLocation()
  const onDashboard = pathname === '/dashboard'

  return (
    <Box
      as="aside"
      display="flex"
      flexDirection="column"
      h="full"
      bg="bg.sidebar"
      borderEndWidth="1px"
      borderColor="border.subtle"
    >
      <Box asChild>
        <RouterLink to="/dashboard">
          {/* Same wordmark and ✳ mark as the landing page's navbar. */}
          <Flex align="center" gap="2.5" px="5" pt="5" pb="4" _focusVisible={focusRing}>
            <Text
              as="span"
              fontFamily="heading"
              fontWeight="bold"
              fontSize="19px"
              letterSpacing="tight"
              lineHeight="tight"
            >
              AI-Powered
              <br /> Course Generator
            </Text>
            <Text as="span" aria-hidden="true" fontSize="22px" lineHeight="none" fontWeight="light">
              ✳
            </Text>
          </Flex>
        </RouterLink>
      </Box>

      <Box as="nav" aria-label="Courses" display="flex" flexDirection="column" flex="1" minH="0">
        <Box px="3">
          <Box asChild>
            <RouterLink to="/dashboard" aria-current={onDashboard ? 'page' : undefined}>
              <Flex
                align="center"
                gap="3"
                minH="44px"
                px="4"
                rounded="full"
                fontWeight="medium"
                bg={onDashboard ? 'accent.subtle' : 'transparent'}
                _hover={{ bg: onDashboard ? 'accent.subtle' : 'bg.muted' }}
                _focusVisible={focusRing}
              >
                <HomeIcon size="20px" />
                Dashboard
              </Flex>
            </RouterLink>
          </Box>
        </Box>

        <Text
          id="your-courses-heading"
          mt="8"
          mb="2"
          px="5"
          fontSize="xs"
          fontWeight="semibold"
          letterSpacing="wider"
          color="text.muted"
        >
          YOUR COURSES
        </Text>

        <Box flex="1" minH="0" overflowY="auto" px="3" pb="6">
          <CourseTree />
        </Box>
      </Box>
    </Box>
  )
}
