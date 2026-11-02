import { useState } from 'react'
import { Box, Button, Collapsible, Stack, Text } from '@chakra-ui/react'
import { ChevronDownIcon, ChevronRightIcon } from '../../dashboard/icons.jsx'

// The Hinglish script under the player, closed by default. AI text, so it is plain text only
// (no InlineText, never HTML).
export default function Transcript({ script }) {
  const [open, setOpen] = useState(false)
  if (!script?.length) return null

  return (
    <Collapsible.Root open={open} onOpenChange={(details) => setOpen(details.open)} mt="3">
      <Collapsible.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          minH="44px"
          px="2"
          gap="2"
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
        >
          {open ? <ChevronDownIcon size="18px" /> : <ChevronRightIcon size="18px" />}
          {open ? 'Hide transcript' : 'Show transcript'}
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Box mt="2" pl="2" borderLeftWidth="2px" borderColor="border.subtle">
          <Stack gap="3">
            {script.map((paragraph, i) => (
              <Text key={i} color="fg" lineHeight="tall">
                {paragraph}
              </Text>
            ))}
          </Stack>
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
