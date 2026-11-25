import { useState } from 'react'
import InlineText from './InlineText.jsx'

// One self-check question. The answer is kept only in this component; it isn't saved.
export default function MCQBlock({ block, number }) {
  const [selected, setSelected] = useState(null)
  const [checked, setChecked] = useState(false)
  const correct = selected === block.answer

  const optionClass = (index) => {
    if (checked && index === block.answer) return 'border-success bg-success/10'
    if (checked && index === selected) return 'border-red-400 bg-red-50'
    return 'border-line hover:bg-cream'
  }

  return (
    <fieldset className="rounded-xl border border-line bg-white p-4 md:p-5">
      <legend className="px-1 font-medium">
        {number}. <InlineText text={block.question} />
      </legend>

      <div className="mt-2 space-y-2">
        {block.options.map((option, index) => (
          <label key={index} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${optionClass(index)}`}>
            <input
              type="radio"
              name={`question-${number}`}
              checked={selected === index}
              onChange={() => setSelected(index)}
              disabled={checked}
              className="accent-accent"
            />
            <span className="flex-1">
              <InlineText text={option} />
            </span>
            {checked && index === block.answer && <span className="text-success">✓ Correct answer</span>}
          </label>
        ))}
      </div>

      {checked ? (
        <div className="mt-4" aria-live="polite">
          <p className={`font-semibold ${correct ? 'text-success' : 'text-red-700'}`}>
            {correct ? 'Correct!' : 'Not quite.'}
          </p>
          <p className="mt-1 text-muted">
            <InlineText text={block.explanation} />
          </p>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary mt-4"
          disabled={selected === null}
          onClick={() => setChecked(true)}
        >
          Check answer
        </button>
      )}
    </fieldset>
  )
}
