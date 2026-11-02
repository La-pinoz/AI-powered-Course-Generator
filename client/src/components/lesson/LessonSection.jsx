import { useState } from 'react'
import { Box, Collapsible, Flex, Text } from '@chakra-ui/react'
import { ChevronDownIcon, ChevronRightIcon } from '../dashboard/icons.jsx'

// One full-width collapsible bar. The page keys it by lesson, so open/closed resets to the section's
// default when the lesson changes. `lazyMount` mounts the content when first opened; it then stays
// mounted, so quiz answers survive closing the bar.
export default function LessonSection({ section, lesson, course }) {
  const [open, setOpen] = useState(Boolean(section.defaultOpen))
  const { Component } = section
  const context = { lesson, course }
  const subtitle = typeof section.subtitle === 'function' ? section.subtitle(context) : section.subtitle

  return (
    <Box bg="bg.panel" borderWidth="1px" borderColor="border.subtle" rounded="2xl" overflow="hidden">
      <Collapsible.Root open={open} onOpenChange={(details) => setOpen(details.open)} lazyMount>
        <Box as="h3" m="0">
          <Collapsible.Trigger
            w="full"
            display="flex"
            alignItems="center"
            gap="3"
            minH="56px"
            px={{ base: '4', md: '5' }}
            py="3"
            textAlign="start"
            cursor="pointer"
            _hover={{ bg: 'bg.muted' }}
            _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '-2px' }}
          >
            <Flex direction="column" flex="1" minW="0">
              <Text as="span" fontSize="lg" fontWeight="medium" letterSpacing="tight">
                {section.title}
              </Text>
              {subtitle && (
                <Text as="span" fontSize="sm" color="text.muted">
                  {subtitle}
                </Text>
              )}
            </Flex>
            <Box as="span" flexShrink="0" display="inline-flex">
              {open ? <ChevronDownIcon size="20px" /> : <ChevronRightIcon size="20px" />}
            </Box>
          </Collapsible.Trigger>
        </Box>
        <Collapsible.Content>
          <Box px={{ base: '4', md: '5' }} pb={{ base: '5', md: '6' }} pt="2">
            <Component lesson={lesson} course={course} />
          </Box>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  )
}
