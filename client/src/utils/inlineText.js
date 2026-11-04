// AI-written text is plain text with only **bold** and `inline code`. Parsed into tokens so renderers
// build real elements; nothing is ever injected as HTML, and links are not supported.
const TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g

export function parseInlineText(text) {
  return String(text ?? '')
    .split(TOKEN)
    .map((part) => {
      if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
        return { type: 'bold', text: part.slice(2, -2) }
      }
      if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
        return { type: 'code', text: part.slice(1, -1) }
      }
      return { type: 'text', text: part }
    })
}
