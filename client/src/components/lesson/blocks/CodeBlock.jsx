import { useEffect, useRef, useState } from 'react'
import { Box, Button, Flex, Text, VisuallyHidden } from '@chakra-ui/react'
import { CheckIcon, CopyIcon } from '../../dashboard/icons.jsx'

// Plain monospace code with a language label and a Copy button. No syntax highlighting on purpose.
export default function CodeBlock({ block }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.text)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be blocked; the code is still selectable.
    }
  }

  return (
    <Box bg="bg.panel" borderWidth="1px" borderColor="border.subtle" rounded="xl" overflow="hidden">
      <Flex align="center" justify="space-between" px="4" borderBottomWidth="1px" borderColor="border.subtle">
        <Text as="span" fontSize="xs" color="text.muted" textTransform="uppercase" letterSpacing="wider">
          {block.language}
        </Text>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          minH={{ base: '44px', md: '36px' }}
          gap="2"
          onClick={copy}
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '-2px' }}
        >
          {copied ? <CheckIcon size="14px" /> : <CopyIcon size="14px" />}
          {copied ? 'Copied' : 'Copy'}
          <VisuallyHidden> code</VisuallyHidden>
        </Button>
      </Flex>
      {/* Long lines wrap instead of scrolling, so the page's own scrollbar is the only one. */}
      <Box
        as="pre"
        m="0"
        p="4"
        whiteSpace="pre-wrap"
        overflowWrap="anywhere"
        fontFamily="mono"
        fontSize="sm"
        lineHeight="1.6"
      >
        <code>{block.text}</code>
      </Box>
    </Box>
  )
}
