import { Box, Skeleton, Stack, VisuallyHidden } from '@chakra-ui/react'

// First fetch: a header and three section bars.
export default function LessonSkeleton() {
  return (
    <Box role="status" aria-busy="true">
      <VisuallyHidden>Loading lesson…</VisuallyHidden>
      <Skeleton h="4" w="40%" />
      <Skeleton h="9" w="75%" mt="3" />
      <Skeleton h="4" w="55%" mt="6" />
      <Stack gap="3" mt="8">
        <Skeleton h="56px" rounded="2xl" />
        <Skeleton h="56px" rounded="2xl" />
        <Skeleton h="56px" rounded="2xl" />
      </Stack>
    </Box>
  )
}
