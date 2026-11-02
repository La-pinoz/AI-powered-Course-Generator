import { Box, Heading, Text } from '@chakra-ui/react'
import InlineText from './InlineText.jsx'

export default function ExampleBlock({ block }) {
  return (
    <Box
      as="aside"
      bg="accent.subtle"
      borderWidth="1px"
      borderColor="accent.muted"
      borderLeftWidth="4px"
      borderLeftColor="accent"
      rounded="xl"
      p="4"
    >
      <Text fontSize="xs" fontWeight="semibold" color="accent.fg" textTransform="uppercase" letterSpacing="wider">
        Example
      </Text>
      <Heading as="h4" size="md" fontWeight="medium" letterSpacing="tight" mt="1">
        <InlineText text={block.title} />
      </Heading>
      <Text mt="2" lineHeight="1.7">
        <InlineText text={block.text} />
      </Text>
    </Box>
  )
}
