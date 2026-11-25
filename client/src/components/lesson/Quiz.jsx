import MCQBlock from './blocks/MCQBlock.jsx'

// The lesson's multiple-choice questions, for self-checking.
export default function Quiz({ content }) {
  const questions = content.filter((block) => block.type === 'mcq')
  if (questions.length === 0) return null

  return (
    <section className="card" aria-labelledby="quiz-heading">
      <h2 id="quiz-heading" className="text-2xl font-medium">
        Quiz
      </h2>
      <p className="mt-1 text-sm text-muted">{questions.length} questions · check your understanding</p>
      <div className="mt-5 space-y-4">
        {questions.map((block, index) => (
          <MCQBlock key={index} block={block} number={index + 1} />
        ))}
      </div>
    </section>
  )
}
