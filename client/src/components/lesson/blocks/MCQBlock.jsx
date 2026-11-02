import { useId } from 'react'
import { Box, Button, Flex, Text, VisuallyHidden } from '@chakra-ui/react'
import { CheckIcon, XIcon } from '../../dashboard/icons.jsx'
import InlineText from './InlineText.jsx'

// One self-check question. Controlled by QuizSection: `answer` is { selected, checked } or undefined.
// Right and wrong are shown with an icon and hidden text as well as colour.
export default function MCQBlock({ block, index, answer, onSelect, onCheck }) {
  const name = useId()
  const selected = answer?.selected ?? null
  const checked = answer?.checked === true
  const correct = checked && selected === block.answer

  return (
    <Box
      as="fieldset"
      m="0"
      minW="0"
      p={{ base: '4', md: '5' }}
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="xl"
    >
      <Box as="legend" px="1" fontWeight="medium" lineHeight="1.6">
        {index + 1}. <InlineText text={block.question} />
      </Box>

      <Flex direction="column" gap="2" mt="3">
        {block.options.map((option, optionIndex) => {
          const isRight = checked && optionIndex === block.answer
          const isWrongPick = checked && optionIndex === selected && optionIndex !== block.answer
          return (
            <Flex
              as="label"
              key={optionIndex}
              align="center"
              gap="3"
              minH="44px"
              px="3"
              py="2"
              rounded="lg"
              borderWidth="1px"
              borderColor={isRight ? 'success' : isWrongPick ? 'danger.fg' : 'border.subtle'}
              bg={isRight ? 'success.subtle' : isWrongPick ? 'danger.bg' : 'transparent'}
              cursor={checked ? 'default' : 'pointer'}
              _hover={checked ? undefined : { bg: 'bg.muted' }}
              _focusWithin={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
            >
              <Box
                as="input"
                type="radio"
                name={name}
                value={optionIndex}
                checked={selected === optionIndex}
                disabled={checked}
                onChange={() => onSelect(optionIndex)}
                accentColor="accent"
                w="4"
                h="4"
                flexShrink="0"
              />
              <Text as="span" flex="1" minW="0" overflowWrap="anywhere">
                <InlineText text={option} />
              </Text>
              {isRight && (
                <>
                  <Box as="span" display="inline-flex" color="success">
                    <CheckIcon size="18px" />
                  </Box>
                  <VisuallyHidden>(correct answer)</VisuallyHidden>
                </>
              )}
              {isWrongPick && (
                <>
                  <Box as="span" display="inline-flex" color="danger.fg">
                    <XIcon size="18px" />
                  </Box>
                  <VisuallyHidden>(your answer, incorrect)</VisuallyHidden>
                </>
              )}
            </Flex>
          )
        })}
      </Flex>

      {!checked && (
        <Button
          type="button"
          mt="4"
          variant="outline"
          borderColor="border.emphasized"
          minH="44px"
          disabled={selected === null}
          onClick={() => onCheck(index)}
        >
          Check
        </Button>
      )}

      {/* Always mounted so screen readers announce the result when it appears. */}
      <Box aria-live="polite" mt={checked ? '4' : '0'}>
        {checked && (
          <>
            <Text fontWeight="semibold" color={correct ? 'success' : 'danger.fg'}>
              {correct ? 'Correct' : 'Not quite'}
            </Text>
            <Text mt="1" color="text.muted" lineHeight="1.7">
              <InlineText text={block.explanation} />
            </Text>
          </>
        )}
      </Box>
    </Box>
  )
}
