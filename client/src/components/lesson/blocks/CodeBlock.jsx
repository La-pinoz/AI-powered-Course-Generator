import { useState } from 'react'

// Code with its language and a Copy button.
export default function CodeBlock({ block }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // The browser blocked clipboard access; the code can still be selected by hand.
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#F4F1EA]">
      <div className="flex items-center justify-between border-b border-line px-4 py-1">
        <span className="text-xs tracking-wide text-muted uppercase">{block.language}</span>
        <button type="button" onClick={copy} className="rounded px-2 py-1 text-sm hover:bg-line">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
        <code>{block.text}</code>
      </pre>
    </div>
  )
}
