import { Avatar, Box, Button, Menu, Portal, Text, useBreakpointValue } from '@chakra-ui/react'
import { useAuth0 } from '@auth0/auth0-react'
import { ChevronDownIcon, LogoutIcon } from './icons.jsx'

export default function UserMenu({ user }) {
  const { logout } = useAuth0()
  // The name is hidden below 480px, so the avatar then needs the accessible name.
  const nameHidden = useBreakpointValue({ base: true, sm: false })

  return (
    <Menu.Root positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button
          variant="outline"
          rounded="full"
          color="fg"
          borderColor="border.subtle"
          bg="bg.panel"
          px="2"
          h="12"
          minW="12"
          gap="2"
          aria-label={nameHidden ? `Account menu for ${user.name}` : undefined}
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
        >
          <Avatar.Root size="sm">
            <Avatar.Fallback name={user.name} bg="brand" color="fg" />
            {user.picture && <Avatar.Image src={user.picture} alt={nameHidden ? user.name : ''} />}
          </Avatar.Root>
          <Text as="span" hideBelow="sm" maxW="48" truncate fontWeight="medium">
            {user.name}
          </Text>
          <ChevronDownIcon size="16px" />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="240px" bg="bg.panel" borderWidth="1px" borderColor="border.subtle">
            <Box px="3" py="2">
              <Text fontWeight="bold">{user.name}</Text>
              <Text fontSize="sm" color="text.muted">
                {user.email}
              </Text>
            </Box>
            <Menu.Separator borderColor="border.subtle" />
            <Menu.Item
              value="logout"
              color="danger.fg"
              minH={{ base: '44px', md: 'auto' }}
              onSelect={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              <LogoutIcon size="18px" />
              Log out
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
