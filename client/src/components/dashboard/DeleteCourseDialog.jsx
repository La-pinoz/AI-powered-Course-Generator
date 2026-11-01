import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Dialog, Portal, Spinner, Text } from '@chakra-ui/react'
import useCourses from '../../hooks/useCourses.js'
import { toaster } from './toaster.js'

export default function DeleteCourseDialog({ course, open, onOpenChange, onDeleted }) {
  const { deleteCourse, routeCourseId } = useCourses()
  const navigate = useNavigate()
  const cancelRef = useRef(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleOpenChange = (details) => {
    if (deleting) return
    if (!details.open) setError('')
    onOpenChange(details.open)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      // Removes the course (card, sidebar entry, stats) from the context once the API confirms.
      await deleteCourse(course._id)
      toaster.create({ title: 'Course deleted', type: 'success', closable: true })
      if (routeCourseId === course._id) navigate('/dashboard')
      onDeleted?.()
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  return (
    <Dialog.Root
      role="alertdialog"
      open={open}
      onOpenChange={handleOpenChange}
      initialFocusEl={() => cancelRef.current}
      closeOnInteractOutside={!deleting}
      closeOnEscape={!deleting}
      placement="center"
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border.subtle" mx="4">
            <Dialog.Header>
              <Dialog.Title fontWeight="medium" letterSpacing="tight">
                Delete course?
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text color="text.muted">
                &quot;{course.title}&quot; and all its modules, lessons and progress will be permanently
                deleted.
              </Text>
              {error && (
                <Box
                  role="alert"
                  mt="4"
                  px="3"
                  py="2"
                  rounded="md"
                  bg="danger.bg"
                  color="danger.fg"
                  fontSize="sm"
                >
                  {error}
                </Box>
              )}
            </Dialog.Body>
            <Dialog.Footer gap="3">
              <Button
                ref={cancelRef}
                variant="outline"
                borderColor="border.subtle"
                minH={{ base: '44px', md: '40px' }}
                disabled={deleting}
                onClick={() => handleOpenChange({ open: false })}
              >
                Cancel
              </Button>
              <Button
                bg="brand"
                color="white"
                _hover={{ opacity: 0.85 }}
                minH={{ base: '44px', md: '40px' }}
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting && <Spinner size="sm" />}
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
