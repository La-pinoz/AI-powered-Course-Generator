import HeadingBlock from './blocks/HeadingBlock.jsx'
import ParagraphBlock from './blocks/ParagraphBlock.jsx'
import ListBlock from './blocks/ListBlock.jsx'
import CodeBlock from './blocks/CodeBlock.jsx'
import ExampleBlock from './blocks/ExampleBlock.jsx'
import CalloutBlock from './blocks/CalloutBlock.jsx'

// Which component draws which block type. Quiz questions (`mcq`) are drawn by Quiz instead.
const BLOCKS = {
  heading: HeadingBlock,
  paragraph: ParagraphBlock,
  list: ListBlock,
  code: CodeBlock,
  example: ExampleBlock,
  callout: CalloutBlock,
}

// Draws a lesson's content array in order. Unknown block types are skipped, so new types added on
// the server never break the page.
export default function LessonRenderer({ content }) {
  return (
    <div className="space-y-5">
      {content.map((block, index) => {
        const Block = BLOCKS[block.type]
        return Block ? <Block key={index} block={block} /> : null
      })}
    </div>
  )
}
