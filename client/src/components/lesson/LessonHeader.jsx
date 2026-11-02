import { Box, Heading, Text } from '@chakra-ui/react'

// Title and objectives come from the outline, so this shows even while the lesson is being written.
// The TopBar h1 stays the course title; the lesson title is the h2 that gets focus on navigation.
export default function LessonHeader({ lesson, headingRef }) {
  return (
    <Box as="header">
      <Text fontSize="sm" color="text.muted">
        Module {lesson.moduleOrder} · {lesson.moduleTitle}
      </Text>
      <Heading
        as="h2"
        ref={headingRef}
        tabIndex={-1}
        mt="1"
        size={{ base: '2xl', md: '3xl' }}
        fontWeight="medium"
        letterSpacing="tight"
        _focusVisible={{ outline: 'none' }}
      >
        Lesson {lesson.order}: {lesson.title}
      </Heading>
      {lesson.objectives?.length > 0 && (
        <Box mt="5">
          <Text fontWeight="medium">In this lesson you will…</Text>
          <Box as="ul" mt="2" ps="5" m="0" display="flex" flexDirection="column" gap="1" color="text.muted">
            {lesson.objectives.map((objective, index) => (
              <li key={index}>{objective}</li>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
