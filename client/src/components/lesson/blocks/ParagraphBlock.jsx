import { Text } from '@chakra-ui/react'
import InlineText from './InlineText.jsx'

export default function ParagraphBlock({ block }) {
  return (
    <Text lineHeight="1.75" fontSize="md">
      <InlineText text={block.text} />
    </Text>
  )
}
