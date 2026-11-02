import { Box, Button, Flex, Heading, Spinner, Text } from '@chakra-ui/react'
import { WarningIcon } from '../dashboard/icons.jsx'
import PillButton from '../dashboard/PillButton.jsx'

const cardProps = {
  bg: 'bg.panel',
  borderWidth: '1px',
  borderColor: 'border.subtle',
  rounded: '2xl',
  p: { base: '5', md: '8' },
}

// The card shown in place of the lesson sections:
//   preparing: the lesson is pending or being written (polled by the page)
//   failed:    the server gave up on it; Retry asks for it again
//   notFound:  no such lesson or course
//   error:     the request itself failed (network, auth); Try again reloads
export default function LessonStatusCard({ kind, message, onRetry }) {
  if (kind === 'preparing') {
    return (
      <Flex role="status" align="center" gap="4" {...cardProps}>
        <Spinner size="md" color="accent" flexShrink="0" />
        <Box>
          <Text fontWeight="medium">Preparing this lesson…</Text>
          <Text color="text.muted" fontSize="sm">
            This usually takes 10–30 seconds.
          </Text>
        </Box>
      </Flex>
    )
  }

  if (kind === 'failed' || kind === 'error') {
    return (
      <Box role="alert" {...cardProps} bg="danger.bg" borderColor="danger.fg">
        <Flex align="center" gap="3" color="danger.fg">
          <Box as="span" display="inline-flex" flexShrink="0">
            <WarningIcon size="22px" />
          </Box>
          <Heading as="h3" size="md" fontWeight="medium">
            {kind === 'failed' ? "We couldn't write this lesson." : message}
          </Heading>
        </Flex>
        <Button
          type="button"
          mt="4"
          variant="outline"
          borderColor="danger.fg"
          color="fg"
          minH="44px"
          onClick={onRetry}
        >
          {kind === 'failed' ? 'Retry' : 'Try again'}
        </Button>
      </Box>
    )
  }

  return (
    <Box {...cardProps}>
      <Heading as="h3" size="xl" fontWeight="medium" letterSpacing="tight">
        Lesson not found
      </Heading>
      <PillButton to="/dashboard" mt="6">
        Back to dashboard
      </PillButton>
    </Box>
  )
}
