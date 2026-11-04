import { useEffect, useRef, useState } from 'react'
import { Box, Link, Text } from '@chakra-ui/react'
import { PlayIcon } from '../dashboard/icons.jsx'
import { loadYouTubeApi } from '../../utils/youtubeApi.js'

// The video has been removed or made private (100), or its owner doesn't allow embedding (101, 150).
const UNAVAILABLE_CODES = new Set([100, 101, 150])

// A thumbnail with a play button; nothing from the YouTube player loads until it is clicked. Keyed by
// videoId in the page, so a different video starts back at its thumbnail.
export default function VideoPlayer({ video, onUnavailable }) {
  const [started, setStarted] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const frameRef = useRef(null)
  const { videoId, title } = video

  useEffect(() => {
    if (!started) return undefined

    // The API replaces the element it is given with an iframe, so React must not own that element.
    const frame = frameRef.current
    const host = document.createElement('div')
    frame.appendChild(host)

    let cancelled = false
    let player = null

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        player = new YT.Player(host, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, origin: window.location.origin },
          events: {
            onReady: (event) => {
              event.target.getIframe().title = `YouTube video player: ${title}`
              event.target.playVideo()
            },
            onError: (event) => {
              if (UNAVAILABLE_CODES.has(event.data)) onUnavailable(videoId)
            },
          },
        })
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => {
      cancelled = true
      player?.destroy?.()
      frame.replaceChildren()
    }
  }, [started, videoId, title, onUnavailable])

  return (
    <Box position="relative" aspectRatio="16 / 9" w="full" bg="black" rounded="2xl" overflow="hidden">
      {started ? (
        <>
          <Box ref={frameRef} position="absolute" inset="0" css={{ '& iframe': { width: '100%', height: '100%', border: 0 } }} />
          {loadFailed && (
            <Box position="absolute" inset="0" display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap="2" p="4" textAlign="center" color="white">
              <Text>The YouTube player couldn't be loaded.</Text>
              <Link
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noreferrer"
                color="white"
                textDecoration="underline"
                minH="44px"
                display="inline-flex"
                alignItems="center"
              >
                Watch on YouTube
              </Link>
            </Box>
          )}
        </>
      ) : (
        <Box
          as="button"
          type="button"
          aria-label={`Play video: ${title}`}
          onClick={() => setStarted(true)}
          position="absolute"
          inset="0"
          w="full"
          h="full"
          p="0"
          borderWidth="0"
          cursor="pointer"
          display="block"
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent', outlineOffset: '-4px' }}
        >
          <Box as="img" src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" w="full" h="full" objectFit="cover" />
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            w="72px"
            h="72px"
            rounded="full"
            bg="white"
            color="brand"
            display="flex"
            alignItems="center"
            justifyContent="center"
            shadow="xl"
          >
            <PlayIcon size="28px" />
          </Box>
        </Box>
      )}
    </Box>
  )
}
