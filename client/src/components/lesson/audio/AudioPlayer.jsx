import { forwardRef, useEffect, useRef, useState } from 'react'
import { Box, Button, Flex, IconButton, Menu, Portal, Slider, Text } from '@chakra-ui/react'
import { DownloadIcon, PauseIcon, PlayIcon } from '../../dashboard/icons.jsx'

const SPEEDS = ['0.75', '1', '1.25', '1.5']
const SEEK_STEP = 5 // seconds per arrow key

const focusRing = { outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' }

const clock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// A small custom player over a hidden <audio>: play/pause, seek, time, speed and download.
// `url` is an object URL (null while the file is loading: the controls are then disabled).
// The ref goes to the play button, so the section can move focus there when the audio is ready.
const AudioPlayer = forwardRef(function AudioPlayer({ url, durationSec, filename, onError }, playRef) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(durationSec || 0)
  const [speed, setSpeed] = useState('1')
  const disabled = !url

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = Number(speed)
  }, [speed, url])

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) el.play().catch(() => onError?.())
    else el.pause()
  }

  const seek = (seconds) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = Math.min(Math.max(seconds, 0), duration || el.duration || 0)
    setCurrent(el.currentTime)
  }

  return (
    <Box bg="bg.muted" borderWidth="1px" borderColor="border.subtle" rounded="xl" p={{ base: '3', md: '4' }}>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => onError?.()}
        />
      )}

      <Flex align="center" gap={{ base: '2', md: '3' }}>
        <IconButton
          ref={playRef}
          type="button"
          rounded="full"
          bg="white"
          color="brand"
          minW="44px"
          minH="44px"
          flexShrink="0"
          disabled={disabled}
          aria-label={playing ? 'Pause' : 'Play Hinglish audio'}
          onClick={toggle}
          _hover={{ bg: 'gray.100' }}
          _focusVisible={focusRing}
        >
          {playing ? <PauseIcon size="20px" /> : <PlayIcon size="20px" />}
        </IconButton>

        <Slider.Root
          flex="1"
          minW="0"
          min={0}
          max={Math.max(duration, 1)}
          step={SEEK_STEP}
          value={[Math.min(current, Math.max(duration, 1))]}
          onValueChange={({ value }) => seek(value[0])}
          disabled={disabled}
          aria-label={['Seek']}
          getAriaValueText={({ value }) => `${clock(value)} of ${clock(duration)}`}
          colorPalette="accent"
          size="sm"
        >
          <Slider.Control minH="44px">
            <Slider.Track bg="border.subtle">
              <Slider.Range />
            </Slider.Track>
            <Slider.Thumbs _focusVisible={focusRing} />
          </Slider.Control>
        </Slider.Root>

        <Text fontSize="sm" color="text.muted" flexShrink="0" fontVariantNumeric="tabular-nums" aria-hidden="true">
          {clock(current)} / {clock(duration)}
        </Text>
      </Flex>

      <Flex mt="2" gap="2" justify="flex-end" wrap="wrap">
        <Menu.Root onSelect={({ value }) => setSpeed(value)}>
          <Menu.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              minH="44px"
              disabled={disabled}
              aria-label={`Playback speed, ${speed}×`}
              _focusVisible={focusRing}
            >
              {speed}×
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content bg="bg.panel" borderWidth="1px" borderColor="border.subtle">
                {SPEEDS.map((value) => (
                  <Menu.Item key={value} value={value} minH="44px" fontWeight={value === speed ? 'semibold' : 'normal'}>
                    {value}× {value === speed && <Box as="span" srOnly>(current)</Box>}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>

        <Button
          asChild={!disabled}
          type={disabled ? 'button' : undefined}
          variant="outline"
          size="sm"
          minH="44px"
          gap="2"
          disabled={disabled}
          borderColor="border.subtle"
          _focusVisible={focusRing}
        >
          {disabled ? (
            <>
              <DownloadIcon size="18px" /> Download MP3
            </>
          ) : (
            <a href={url} download={filename}>
              <DownloadIcon size="18px" /> Download MP3
            </a>
          )}
        </Button>
      </Flex>
    </Box>
  )
})

export default AudioPlayer
