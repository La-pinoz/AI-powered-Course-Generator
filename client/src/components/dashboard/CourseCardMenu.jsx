import { IconButton, Menu, Portal } from '@chakra-ui/react'
import { MoreIcon } from './icons.jsx'

export default function CourseCardMenu({ course, onDelete }) {
  return (
    <Menu.Root
      positioning={{ placement: 'bottom-end' }}
      onSelect={(details) => {
        // Open the dialog a moment after the menu closes, so the menu's focus return to the
        // trigger can't steal focus from the dialog's initial focus (Cancel).
        if (details.value === 'delete') setTimeout(onDelete, 100)
      }}
    >
      <Menu.Trigger asChild>
        <IconButton
          variant="ghost"
          size="sm"
          position="relative"
          zIndex="1"
          minW={{ base: '44px', md: '32px' }}
          minH={{ base: '44px', md: '32px' }}
          aria-label={`Options for ${course.title}`}
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
        >
          <MoreIcon size="20px" />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content bg="bg.panel" borderWidth="1px" borderColor="border.subtle">
            <Menu.Item value="delete" color="danger.fg" minH={{ base: '44px', md: 'auto' }}>
              Delete
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
