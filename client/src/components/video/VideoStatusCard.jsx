import { Box, Button, Flex, Heading, Skeleton, Spinner, Text, VisuallyHidden } from '@chakra-ui/react'
import { WarningIcon } from '../dashboard/icons.jsx'
import PillButton from '../dashboard/PillButton.jsx'

const cardProps = {
  bg: 'bg.panel',
  borderWidth: '1px',
  borderColor: 'border.subtle',
  rounded: '2xl',
  p: { base: '5', md: '8' },
}

const actionProps = { type: 'button', mt: '4', variant: 'outline', minH: '44px' }

// Every state of the video page except the player itself.
export default function VideoStatusCard({ kind, message, canSearchAgain, onRetry }) {
  if (kind === 'loading') {
    return (
      <Box role="status" aria-busy="true">
        <VisuallyHidden>Loading the video…</VisuallyHidden>
        <Skeleton aspectRatio="16 / 9" w="full" rounded="2xl" />
      </Box>
    )
  }

  if (kind === 'searching') {
    return (
      <Flex role="status" align="center" gap="4" {...cardProps}>
        <Spinner size="md" color="accent" flexShrink="0" />
        <Box>
          <Text fontWeight="medium">Finding a video for this module…</Text>
          <Text color="text.muted" fontSize="sm">
            This usually takes 10–30 seconds.
          </Text>
        </Box>
      </Flex>
    )
  }

  if (kind === 'none') {
    return (
      <Box {...cardProps}>
        <Text fontWeight="medium">No suitable video found for this module.</Text>
        {canSearchAgain && (
          <Button {...actionProps} borderColor="border.emphasized" onClick={onRetry}>
            Search again
          </Button>
        )}
      </Box>
    )
  }

  if (kind === 'limit') {
    return (
      <Box {...cardProps}>
        <Text fontWeight="medium">You've reached today's limit for finding new videos.</Text>
        <Text color="text.muted" fontSize="sm" mt="1">
          Videos already found still play.
        </Text>
      </Box>
    )
  }

  if (kind === 'notFound') {
    return (
      <Box {...cardProps}>
        <Heading as="h2" size="xl" fontWeight="medium" letterSpacing="tight">
          Video page not found
        </Heading>
        <PillButton to="/dashboard" mt="6">
          Back to dashboard
        </PillButton>
      </Box>
    )
  }

  // failed, unavailable, error
  return (
    <Box role="alert" {...cardProps} bg="danger.bg" borderColor="danger.fg">
      <Flex align="center" gap="3" color="danger.fg">
        <Box as="span" display="inline-flex" flexShrink="0">
          <WarningIcon size="22px" />
        </Box>
        <Text fontWeight="medium">{message}</Text>
      </Flex>
      <Button {...actionProps} borderColor="danger.fg" color="fg" onClick={onRetry}>
        Try again
      </Button>
    </Box>
  )
}
