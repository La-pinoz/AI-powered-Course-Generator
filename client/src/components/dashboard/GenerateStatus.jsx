import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Flex, Text } from '@chakra-ui/react'
import { HourglassIcon, WarningIcon } from './icons.jsx'
import PillButton from './PillButton.jsx'

const PHASE_HINTS = ['Planning modules…', 'Building modules…', 'Writing lesson titles…', 'Almost there…']
const HINT_INTERVAL_MS = 6000

// Cosmetic only: the server doesn't report phases. Stays on the last hint.
function LoadingBar() {
  const [hintIndex, setHintIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setHintIndex((index) => Math.min(index + 1, PHASE_HINTS.length - 1))
    }, HINT_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    // Live region: the first message is announced; hint changes are aria-hidden so they are not.
    <Flex
      role="status"
      aria-live="polite"
      align="center"
      justify="center"
      gap="3"
      w="full"
      minH="12"
      px="4"
      rounded="lg"
      bg="accent.subtle"
      color="fg"
      borderWidth="1px"
      borderColor="accent"
    >
      <Box display="inline-flex">
        <HourglassIcon size="20px" />
      </Box>
      <Text fontWeight="medium">
        Generating your course…{' '}
        <Text as="span" aria-hidden="true" color="text.muted">
          ({PHASE_HINTS[hintIndex]})
        </Text>
      </Text>
    </Flex>
  )
}

function ApiErrorAlert({ message, onTryAgain }) {
  const tryAgainRef = useRef(null)

  // Move focus to the retry button so keyboard and screen-reader users land on the action.
  useEffect(() => {
    tryAgainRef.current?.focus()
  }, [])

  return (
    <Alert.Root
      role="alert"
      status="error"
      w="full"
      bg="danger.bg"
      color="danger.fg"
      borderWidth="1px"
      borderColor="danger.fg"
      rounded="lg"
      alignItems="center"
      flexWrap="wrap"
      gap="3"
    >
      <Box display="inline-flex" flexShrink="0">
        <WarningIcon size="20px" />
      </Box>
      <Alert.Content flex="1" minW="0" fontSize="md">
        Error generating course: {message}
      </Alert.Content>
      <Button
        ref={tryAgainRef}
        type="button"
        variant="outline"
        size="sm"
        color="fg"
        borderColor="danger.fg"
        minH={{ base: '44px', md: '32px' }}
        onClick={onTryAgain}
      >
        Try again
      </Button>
    </Alert.Root>
  )
}

// The status slot: exactly one of the Generate button, the loading bar, or the API error alert.
export default function GenerateStatus({ phase, errorMessage, onTryAgain }) {
  if (phase === 'loading') return <LoadingBar />
  if (phase === 'error') return <ApiErrorAlert message={errorMessage} onTryAgain={onTryAgain} />

  return (
    <PillButton type="submit" w="full">
      Generate course
    </PillButton>
  )
}
