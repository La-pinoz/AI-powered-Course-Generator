import { useState } from 'react'
import { Box, Button, Flex, Text, VisuallyHidden } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowLeftIcon, CheckIcon } from '../dashboard/icons.jsx'
import PillButton from '../dashboard/PillButton.jsx'

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

// Mark as completed, then Previous / Next. `canComplete` is false until the lesson is ready and the
// progress state is known. `prev` and `next` are { _id, title } or null.
export default function LessonFooter({ courseId, completed, canComplete, onToggleComplete, prev, next }) {
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const toggle = async () => {
    const target = !completed
    setBusy(true)
    const ok = await onToggleComplete(target)
    setBusy(false)
    setAnnouncement(ok ? (target ? 'Lesson marked as completed.' : 'Completion undone.') : '')
  }

  const lessonPath = (lesson) => `/courses/${courseId}/lessons/${lesson._id}`

  return (
    <Box as="footer" mt="8">
      {completed ? (
        <Flex align="center" gap="4" wrap="wrap" minH="44px">
          <Flex align="center" gap="2" color="success" fontWeight="semibold" fontSize="lg">
            <CheckIcon size="20px" />
            Completed
          </Flex>
          <Button
            type="button"
            variant="plain"
            color="text.muted"
            textDecoration="underline"
            minH="44px"
            px="2"
            disabled={busy}
            onClick={toggle}
          >
            Undo
          </Button>
        </Flex>
      ) : (
        <PillButton type="button" disabled={!canComplete || busy} onClick={toggle}>
          Mark as completed
        </PillButton>
      )}

      {/* Persistent so the screen reader announces each change. */}
      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>

      <Flex as="nav" aria-label="Lesson navigation" mt="6" gap="3" direction={{ base: 'column', sm: 'row' }} justify="space-between">
        {prev ? (
          <Button asChild {...navButtonProps}>
            <RouterLink to={lessonPath(prev)}>
              <ArrowLeftIcon size="16px" />
              <Text as="span" minW="0">
                Previous: {prev.title}
              </Text>
            </RouterLink>
          </Button>
        ) : (
          <Box />
        )}
        {next ? (
          <Button asChild {...navButtonProps} justifyContent={{ base: 'flex-start', sm: 'flex-end' }}>
            <RouterLink to={lessonPath(next)}>
              <Text as="span" minW="0">
                Next: {next.title}
              </Text>
              <Box as="span" aria-hidden="true" fontWeight="bold">
                →
              </Box>
            </RouterLink>
          </Button>
        ) : (
          <Button asChild {...navButtonProps} justifyContent={{ base: 'flex-start', sm: 'flex-end' }}>
            <RouterLink to="/dashboard">Back to dashboard</RouterLink>
          </Button>
        )}
      </Flex>
    </Box>
  )
}
