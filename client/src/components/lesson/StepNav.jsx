import { Box, Button, Flex, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowLeftIcon } from '../dashboard/icons.jsx'

const navButtonProps = {
  variant: 'outline',
  borderColor: 'border.emphasized',
  minH: '44px',
  h: 'auto',
  py: '2',
  justifyContent: 'flex-start',
  whiteSpace: 'normal',
  textAlign: 'start',
  _focusVisible: { outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' },
}

const forwardProps = { ...navButtonProps, justifyContent: { base: 'flex-start', sm: 'flex-end' } }

// Previous / Next through a course's videos and lessons. `prev` and `next` are steps from courseSteps
// ({ path, label }) or null. `dashboardAtEnd` shows "Back to dashboard" when there is no `next`.
export default function StepNav({ prev, next, dashboardAtEnd = false }) {
  if (!prev && !next && !dashboardAtEnd) return null

  return (
    <Flex as="nav" aria-label="Course navigation" mt="6" gap="3" direction={{ base: 'column', sm: 'row' }} justify="space-between">
      {prev ? (
        <Button asChild {...navButtonProps}>
          <RouterLink to={prev.path}>
            <ArrowLeftIcon size="16px" />
            <Text as="span" minW="0">
              Previous: {prev.label}
            </Text>
          </RouterLink>
        </Button>
      ) : (
        <Box />
      )}
      {next && (
        <Button asChild {...forwardProps}>
          <RouterLink to={next.path}>
            <Text as="span" minW="0">
              Next: {next.label}
            </Text>
            <Box as="span" aria-hidden="true" fontWeight="bold">
              →
            </Box>
          </RouterLink>
        </Button>
      )}
      {!next && dashboardAtEnd && (
        <Button asChild {...forwardProps}>
          <RouterLink to="/dashboard">Back to dashboard</RouterLink>
        </Button>
      )}
    </Flex>
  )
}
