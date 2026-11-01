import { Box, Field, Input } from '@chakra-ui/react'
import { TOPIC_COUNTER_FROM, TOPIC_ERROR, TOPIC_MAX } from '../../constants/course.js'
import { WarningIcon } from './icons.jsx'

// Shared with the empty state, whose button scrolls to and focuses this input.
export const TOPIC_INPUT_ID = 'topic-input'
const ERROR_ID = 'topic-input-error'
const COUNTER_ID = 'topic-input-counter'

export default function TopicInput({ value, onChange, invalid, disabled, inputRef }) {
  const showCounter = value.length >= TOPIC_COUNTER_FROM
  // Linked explicitly so the error and counter are announced with the input.
  const describedBy = [invalid && ERROR_ID, showCounter && COUNTER_ID].filter(Boolean).join(' ') || undefined

  return (
    <Field.Root invalid={invalid} disabled={disabled} id={TOPIC_INPUT_ID}>
      <Box position="relative" w="full">
        <Field.Label
          position="absolute"
          top="-3"
          insetStart="3"
          zIndex="1"
          px="1"
          bg="bg.panel"
          fontSize="sm"
          color={invalid ? 'danger.fg' : 'accent.fg'}
          fontWeight="normal"
          pointerEvents="none"
        >
          Enter Topic Name
        </Field.Label>
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. Intro to React Hooks"
          maxLength={TOPIC_MAX}
          aria-describedby={describedBy}
          autoComplete="off"
          size="lg"
          bg="bg.panel"
          borderColor="border.subtle"
          _invalid={{ borderColor: 'danger.fg', bg: 'danger.bg' }}
          _focusVisible={{ borderColor: 'accent', outline: '2px solid', outlineColor: 'accent' }}
        />
      </Box>
      <Field.ErrorText id={ERROR_ID} color="danger.fg" fontSize="sm" display="flex" alignItems="center" gap="2">
        <WarningIcon size="16px" />
        {TOPIC_ERROR}
      </Field.ErrorText>
      {showCounter && (
        <Field.HelperText id={COUNTER_ID} color="text.muted" alignSelf="flex-end">
          {value.length}/{TOPIC_MAX}
        </Field.HelperText>
      )}
    </Field.Root>
  )
}
