import { Box, RadioCard, Stack, Text } from '@chakra-ui/react'
import { DEPTH_HELPER, DEPTHS } from '../../constants/course.js'

const HELPER_ID = 'depth-helper'

export default function DepthSelector({ value, onChange, disabled }) {
  return (
    <Box>
      <RadioCard.Root
        value={value}
        onValueChange={(details) => onChange(details.value)}
        disabled={disabled}
        colorPalette="accent"
        aria-describedby={HELPER_ID}
      >
        <RadioCard.Label fontSize="md" fontWeight="semibold" mb="3">
          Course Depth
        </RadioCard.Label>
        <Stack direction={{ base: 'column', md: 'row' }} gap="3" wrap="wrap" align={{ base: 'stretch', md: 'center' }}>
          {DEPTHS.map((depth) => (
            // The border and checked state live on the Item part, not ItemControl.
            <RadioCard.Item
              key={depth.value}
              value={depth.value}
              flex={{ md: '0 0 auto' }}
              rounded="full"
              bg="bg.panel"
              borderColor="border.subtle"
              minH={{ base: '44px', md: 'auto' }}
              _checked={{ borderColor: 'accent', bg: 'accent.subtle', boxShadow: '0 0 0 1px {colors.accent}' }}
              _hover={{ borderColor: 'accent' }}
            >
              <RadioCard.ItemHiddenInput />
              <RadioCard.ItemControl justifyContent="center">
                <RadioCard.ItemText>{depth.label}</RadioCard.ItemText>
              </RadioCard.ItemControl>
            </RadioCard.Item>
          ))}
        </Stack>
      </RadioCard.Root>
      <Text id={HELPER_ID} mt="2" fontSize="sm" color="text.muted">
        {DEPTH_HELPER}
      </Text>
    </Box>
  )
}
