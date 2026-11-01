import { EmptyState, VStack } from '@chakra-ui/react'
import { BookIcon } from './icons.jsx'
import PillButton from './PillButton.jsx'
import { TOPIC_INPUT_ID } from './TopicInput.jsx'

function focusTopicInput() {
  const input = document.getElementById(TOPIC_INPUT_ID)
  if (!input) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  input.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  input.focus({ preventScroll: true })
}

export default function EmptyCourses() {
  return (
    <EmptyState.Root>
      <EmptyState.Content>
        <EmptyState.Indicator color="accent">
          <BookIcon size="48px" />
        </EmptyState.Indicator>
        <VStack textAlign="center">
          <EmptyState.Title>No courses yet</EmptyState.Title>
          <EmptyState.Description color="text.muted">
            Enter a topic above and generate your first course in under a minute.
          </EmptyState.Description>
        </VStack>
        <PillButton onClick={focusTopicInput}>Create your first course</PillButton>
      </EmptyState.Content>
    </EmptyState.Root>
  )
}
