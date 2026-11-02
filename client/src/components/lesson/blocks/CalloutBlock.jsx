import { Box, Flex, Text } from '@chakra-ui/react'
import { InfoIcon, LightbulbIcon, WarningIcon } from '../../dashboard/icons.jsx'
import InlineText from './InlineText.jsx'

// Each tone has a label and an icon as well as a colour.
const TONES = {
  tip: { label: 'Tip', Icon: LightbulbIcon, bg: 'success.subtle', border: 'success', color: 'success' },
  note: { label: 'Note', Icon: InfoIcon, bg: 'bg.panel', border: 'border.emphasized', color: 'text.muted' },
  warning: { label: 'Warning', Icon: WarningIcon, bg: 'danger.bg', border: 'danger.fg', color: 'danger.fg' },
}

export default function CalloutBlock({ block }) {
  const tone = TONES[block.tone] ?? TONES.note
  return (
    <Box
      as="aside"
      bg={tone.bg}
      borderWidth="1px"
      borderColor={tone.border}
      rounded="xl"
      p="4"
    >
      <Flex align="center" gap="2" color={tone.color} fontSize="sm" fontWeight="semibold">
        <Box as="span" display="inline-flex">
          <tone.Icon size="18px" />
        </Box>
        {tone.label}
      </Flex>
      <Text mt="2" lineHeight="1.7">
        <InlineText text={block.text} />
      </Text>
    </Box>
  )
}
