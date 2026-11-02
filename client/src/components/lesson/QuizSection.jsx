import { useState } from 'react'
import { Button, Flex, Stack, Text } from '@chakra-ui/react'
import MCQBlock from './blocks/MCQBlock.jsx'

// Self-check only. Answers live in this component's state: nothing is saved and the quiz never
// touches lesson progress. The section stays mounted when its bar is closed, so answers survive.
export default function QuizSection({ lesson }) {
  const questions = (lesson.content ?? []).filter((block) => block.type === 'mcq')
  const [answers, setAnswers] = useState({}) // question index → { selected, checked }

  const select = (index, selected) =>
    setAnswers((prev) => ({ ...prev, [index]: { selected, checked: false } }))
  const check = (index) =>
    setAnswers((prev) => ({ ...prev, [index]: { ...prev[index], checked: true } }))

  if (questions.length === 0) {
    return <Text color="text.muted">This lesson has no quiz questions.</Text>
  }

  const allChecked = questions.every((_, index) => answers[index]?.checked)
  const score = questions.filter((q, index) => answers[index]?.checked && answers[index].selected === q.answer).length

  return (
    <Stack gap="4">
      {questions.map((block, index) => (
        <MCQBlock
          key={index}
          block={block}
          index={index}
          answer={answers[index]}
          onSelect={(selected) => select(index, selected)}
          onCheck={check}
        />
      ))}

      <Flex aria-live="polite" align="center" justify="space-between" gap="3" wrap="wrap" minH="44px">
        {allChecked && (
          <>
            <Text fontWeight="semibold" fontSize="lg">
              You got {score} of {questions.length}
            </Text>
            <Button type="button" variant="outline" borderColor="border.emphasized" minH="44px" onClick={() => setAnswers({})}>
              Try again
            </Button>
          </>
        )}
      </Flex>
    </Stack>
  )
}
