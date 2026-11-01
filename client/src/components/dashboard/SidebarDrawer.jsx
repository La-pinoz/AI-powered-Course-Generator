import { CloseButton, Drawer, Portal } from '@chakra-ui/react'
import Sidebar from './Sidebar.jsx'

// Mobile (<768px) version of the sidebar. The layout closes it on route change; Chakra handles the
// backdrop, Escape and focus trapping, and `finalFocusEl` returns focus to the hamburger.
export default function SidebarDrawer({ open, onOpenChange, finalFocusRef }) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      placement="start"
      finalFocusEl={() => finalFocusRef.current}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content w="280px" maxW="85vw" bg="bg.sidebar" aria-label="Course navigation">
            <Drawer.CloseTrigger asChild>
              <CloseButton
                size="lg"
                minW="44px"
                minH="44px"
                position="absolute"
                top="2"
                insetEnd="2"
                aria-label="Close navigation"
              />
            </Drawer.CloseTrigger>
            <Drawer.Body p="0">
              <Sidebar />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
