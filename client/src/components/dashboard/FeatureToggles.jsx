import { Checkbox, Fieldset, Stack, Text } from '@chakra-ui/react'

function Toggle({ checked, onChange, disabled, label, description, descriptionId }) {
  return (
    <Stack gap="0">
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(details) => onChange(details.checked === true)}
        disabled={disabled}
        colorPalette="accent"
        alignItems="flex-start"
        minH={{ base: '44px', md: 'auto' }}
        py="1"
      >
        <Checkbox.HiddenInput aria-describedby={descriptionId} />
        <Checkbox.Control mt="0.5" borderColor="fg.muted" />
        <Checkbox.Label fontSize="md">{label}</Checkbox.Label>
      </Checkbox.Root>
      <Text id={descriptionId} ps="7" fontSize="sm" color="text.muted">
        {description}
      </Text>
    </Stack>
  )
}

export default function FeatureToggles({ sideQuest, hinglishAudio, onSideQuestChange, onHinglishChange, disabled }) {
  return (
    <Fieldset.Root>
      <Fieldset.Legend fontSize="md" fontWeight="semibold" mb="2">
        Features &amp; Enhancements
      </Fieldset.Legend>
      <Fieldset.Content gap="3">
        <Toggle
          checked={sideQuest}
          onChange={onSideQuestChange}
          disabled={disabled}
          label="Side Quest Mode"
          description="Provides extra topics to help understand the main subject better"
          descriptionId="side-quest-description"
        />
        <Toggle
          checked={hinglishAudio}
          onChange={onHinglishChange}
          disabled={disabled}
          label="Hinglish audio: listen to lessons explained in Hinglish."
          description="Each lesson includes an audio explanation in Hinglish."
          descriptionId="hinglish-description"
        />
      </Fieldset.Content>
    </Fieldset.Root>
  )
}
