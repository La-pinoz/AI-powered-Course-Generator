import { Box, Button } from '@chakra-ui/react'
import useCourses from '../../hooks/useCourses.js'
import { exportReadiness } from '../../utils/coursePdf/exportReadiness.js'
import { DownloadIcon } from './icons.jsx'
import { toaster } from './toaster.js'

// Downloads the whole course. Icon only on phones, where the full label is still its accessible name.
// aria-disabled rather than disabled, so it keeps focus and its tooltip, and a tap says why it's unavailable.
export default function DownloadPdfButton({ courseId, activeExport, onExport }) {
  const { outlines } = useCourses()
  const outline = outlines[courseId]
  if (outline?.status !== 'ready') return null

  const { enabled, label, fullLabel } = exportReadiness({ courseId, counts: outline.data, activeExport })

  const handleClick = () => {
    if (enabled) onExport(courseId, outline.data)
    else toaster.create({ title: fullLabel, type: 'info', closable: true })
  }

  return (
    <Button
      type="button"
      variant="outline"
      borderColor="border.emphasized"
      flexShrink="0"
      gap="2"
      minW={{ base: '44px', md: 'auto' }}
      minH={{ base: '44px', md: '40px' }}
      px={{ base: '2', md: '3' }}
      aria-label={fullLabel}
      aria-disabled={!enabled}
      title={fullLabel}
      opacity={enabled ? 1 : 0.65}
      cursor={enabled ? 'pointer' : 'not-allowed'}
      onClick={handleClick}
      _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }}
    >
      <DownloadIcon size="18px" />
      <Box as="span" hideBelow="md">
        {label}
      </Box>
    </Button>
  )
}
