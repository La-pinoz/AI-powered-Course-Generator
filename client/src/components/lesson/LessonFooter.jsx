import { useState } from 'react'
import { Box, Button, Flex, VisuallyHidden } from '@chakra-ui/react'
import { CheckIcon } from '../dashboard/icons.jsx'
import PillButton from '../dashboard/PillButton.jsx'
import StepNav from './StepNav.jsx'

// Mark as completed, then Previous / Next. `canComplete` is false until the lesson is ready and the
// progress state is known. `prev` and `next` are steps from courseSteps ({ path, label }) or null.
export default function LessonFooter({ completed, canComplete, onToggleComplete, prev, next }) {
  const [busy, setBusy] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const toggle = async () => {
    const target = !completed
    setBusy(true)
    const ok = await onToggleComplete(target)
    setBusy(false)
    setAnnouncement(ok ? (target ? 'Lesson marked as completed.' : 'Completion undone.') : '')
  }

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

      <StepNav prev={prev} next={next} dashboardAtEnd />
    </Box>
  )
}
