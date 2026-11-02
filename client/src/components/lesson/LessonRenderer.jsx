import { Stack } from '@chakra-ui/react'
import HeadingBlock from './blocks/HeadingBlock.jsx'
import ParagraphBlock from './blocks/ParagraphBlock.jsx'
import ListBlock from './blocks/ListBlock.jsx'
import CodeBlock from './blocks/CodeBlock.jsx'
import ExampleBlock from './blocks/ExampleBlock.jsx'
import CalloutBlock from './blocks/CalloutBlock.jsx'

// Block type → component. Later sessions add a type by adding an entry here.
const blockComponents = {
  heading: HeadingBlock,
  paragraph: ParagraphBlock,
  list: ListBlock,
  code: CodeBlock,
  example: ExampleBlock,
  callout: CalloutBlock,
}

// Renders the explanation: every block except `mcq` (the quiz section shows those), in order.
// Unknown types are skipped, so newer content never breaks an older client.
export default function LessonRenderer({ content }) {
  return (
    <Stack gap="5">
      {content.map((block, index) => {
        if (block.type === 'mcq') return null
        const Block = blockComponents[block.type]
        if (!Block) {
          if (import.meta.env.DEV) console.warn(`Skipping unknown lesson block type "${block.type}"`)
          return null
        }
        return <Block key={index} block={block} />
      })}
    </Stack>
  )
}
