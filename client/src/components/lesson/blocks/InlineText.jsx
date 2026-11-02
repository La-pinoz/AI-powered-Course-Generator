import { Box } from '@chakra-ui/react'

// AI-written text is plain text with only **bold** and `inline code`. Both are parsed into React
// elements here; nothing is ever injected as HTML, and links are not supported.
const TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g

export default function InlineText({ text }) {
  const parts = String(text ?? '').split(TOKEN)
  return parts.map((part, index) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return (
        <Box as="strong" key={index} fontWeight="semibold" color="fg">
          {part.slice(2, -2)}
        </Box>
      )
    }
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
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
          {part.slice(1, -1)}
        </Box>
      )
    }
    return part
  })
}
