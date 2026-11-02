import { Box } from '@chakra-ui/react'
import InlineText from './InlineText.jsx'

export default function ListBlock({ block }) {
  return (
    <Box
      as={block.ordered ? 'ol' : 'ul'}
      ps="6"
      m="0"
      display="flex"
      flexDirection="column"
      gap="2"
      listStyleType={block.ordered ? 'decimal' : 'disc'}
      lineHeight="1.7"
    >
      {block.items.map((item, index) => (
        <li key={index}>
          <InlineText text={item} />
        </li>
      ))}
    </Box>
  )
}
