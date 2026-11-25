import InlineText from './InlineText.jsx'

export default function ListBlock({ block }) {
  const List = block.ordered ? 'ol' : 'ul'
  return (
    <List className={`space-y-1 pl-6 leading-relaxed ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
      {block.items.map((item, index) => (
        <li key={index}>
          <InlineText text={item} />
        </li>
      ))}
    </List>
  )
}
