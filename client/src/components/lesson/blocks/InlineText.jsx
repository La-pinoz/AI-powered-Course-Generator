import { Box } from '@chakra-ui/react'
import { parseInlineText } from '../../../utils/inlineText.js'

export default function InlineText({ text }) {
  return parseInlineText(text).map((part, index) => {
    if (part.type === 'bold') {
      return (
        <Box as="strong" key={index} fontWeight="semibold" color="fg">
          {part.text}
        </Box>
      )
    }
    if (part.type === 'code') {
      return (
        <Box
          as="code"
          key={index}
          px="1.5"
          py="0.5"
          rounded="md"
          bg="bg.muted"
          fontFamily="mono"
          fontSize="0.9em"
          overflowWrap="anywhere"
        >
          {part.text}
        </Box>
      )
    }
    return part.text
  })
}
