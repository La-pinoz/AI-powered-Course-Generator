import { Heading } from '@chakra-ui/react'
import InlineText from './InlineText.jsx'

export default function HeadingBlock({ block }) {
  return (
    <Heading as="h3" size="lg" fontWeight="medium" letterSpacing="tight" mt="2">
      <InlineText text={block.text} />
    </Heading>
  )
}
