import { Box, Button } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'

// The landing page's "Get started for free" button: white pill, brand-colored text, → arrow.
// Pass `to` to render it as a router link instead of a <button>.
export default function PillButton({ children, to, ...props }) {
  const content = (
    <>
      {children}
      <Box as="span" aria-hidden="true" fontSize="lg" lineHeight="none" fontWeight="bold">
        →
      </Box>
    </>
  )

  return (
    <Button
      asChild={Boolean(to)}
      rounded="full"
      bg="white"
      color="brand"
      fontWeight="semibold"
      fontSize={{ base: 'md', sm: '17px' }}
      h="auto"
      px={{ base: '7', sm: '8' }}
      py={{ base: '3.5', sm: '4' }}
      gap="3"
      shadow="xl"
      transitionProperty="all"
      transitionDuration="200ms"
      _hover={{ bg: 'gray.100', transform: 'scale(1.02)' }}
      _active={{ transform: 'scale(0.99)' }}
      _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
      {...props}
    >
      {to ? <RouterLink to={to}>{content}</RouterLink> : content}
    </Button>
  )
}
