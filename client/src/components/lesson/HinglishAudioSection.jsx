import { useEffect, useRef, useState } from 'react'
import { Box, Button, Flex, Heading, Skeleton, Spinner, Text } from '@chakra-ui/react'
import useLessonAudio from '../../hooks/useLessonAudio.js'
import PillButton from '../dashboard/PillButton.jsx'
import { WarningIcon } from '../dashboard/icons.jsx'
import AudioPlayer from './audio/AudioPlayer.jsx'
import Transcript from './audio/Transcript.jsx'

const STAGE_TEXT = {
  script: 'Writing the Hinglish explanation…',
  voice: 'Recording the audio…',
}

const cardProps = { borderWidth: '1px', borderColor: 'border.subtle', rounded: 'xl', p: { base: '4', md: '5' } }

const fileNameFor = (title) =>
  `${
    String(title ?? 'lesson')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'lesson'
  }-hinglish.mp3`

function ErrorCard({ title, message, actionLabel, onAction }) {
  return (
    <Box role="alert" {...cardProps} bg="danger.bg" borderColor="danger.fg">
      <Flex align="center" gap="3" color="danger.fg">
        <Box as="span" display="inline-flex" flexShrink="0">
          <WarningIcon size="20px" />
        </Box>
        <Heading as="h4" size="sm" fontWeight="medium">
          {title}
        </Heading>
      </Flex>
      {message && (
        <Text mt="2" color="fg">
          {message}
        </Text>
      )}
      {onAction && (
        <Button type="button" mt="4" variant="outline" borderColor="danger.fg" color="fg" minH="44px" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}

// The lesson page's "Hinglish audio" section (Spec 6). Opening the bar only reads the status;
// the audio is made when the user clicks "Listen in Hinglish", then cached on the server.
export default function HinglishAudioSection({ lesson }) {
  const audio = useLessonAudio(lesson.courseId, lesson.id)
  const playRef = useRef(null)
  const [announcement, setAnnouncement] = useState('')
  const [playbackFailed, setPlaybackFailed] = useState(false)

  // After a generation finishes in this visit: announce it and move focus to Play (no autoplay).
  const sawGenerating = useRef(false)
  useEffect(() => {
    if (audio.status === 'generating') sawGenerating.current = true
  }, [audio.status])
  useEffect(() => {
    if (audio.file.status === 'ready' && sawGenerating.current) {
      sawGenerating.current = false
      setAnnouncement('Audio ready.')
      playRef.current?.focus()
    }
  }, [audio.file.status])

  let body
  if (audio.status === 'loading') {
    body = <Skeleton height="5" width="70%" rounded="md" />
  } else if (audio.status === 'none') {
    body = (
      <Box>
        <Text color="fg">
          {audio.outdated
            ? 'This lesson changed since its audio was made.'
            : 'Hear this lesson explained in simple Hinglish, like a teacher would. About 1–3 minutes.'}
        </Text>
        <PillButton mt="4" onClick={audio.start} disabled={audio.starting} loading={audio.starting}>
          {audio.outdated ? 'Make new audio' : 'Listen in Hinglish'}
        </PillButton>
        <Text mt="3" fontSize="sm" color="text.muted">
          The first time takes about a minute.
        </Text>
      </Box>
    )
  } else if (audio.status === 'generating') {
    body = (
      <Flex role="status" align="center" gap="4" {...cardProps} bg="bg.muted">
        <Spinner size="md" color="accent" flexShrink="0" />
        <Box>
          <Text fontWeight="medium">{STAGE_TEXT[audio.stage] ?? STAGE_TEXT.script}</Text>
          <Text color="text.muted" fontSize="sm">
            You can keep reading; we&apos;ll keep working on it.
          </Text>
        </Box>
      </Flex>
    )
  } else if (audio.status === 'ready') {
    const fileFailed = audio.file.status === 'error' || playbackFailed
    body = (
      <Box>
        {fileFailed ? (
          <ErrorCard
            title="We couldn't load the audio."
            message={audio.file.error}
            actionLabel="Try again"
            onAction={() => {
              setPlaybackFailed(false)
              audio.reloadFile()
            }}
          />
        ) : (
          <>
            <AudioPlayer
              ref={playRef}
              url={audio.file.url}
              durationSec={audio.durationSec}
              filename={fileNameFor(lesson.title)}
              onError={() => setPlaybackFailed(true)}
            />
            {audio.file.status === 'loading' && (
              <Text mt="2" fontSize="sm" color="text.muted">
                Loading audio…
              </Text>
            )}
          </>
        )}
        <Transcript script={audio.script} />
      </Box>
    )
  } else if (audio.status === 'failed') {
    body = (
      <ErrorCard
        title="We couldn't make the audio for this lesson."
        message={audio.error}
        actionLabel={audio.starting ? 'Trying again…' : 'Try again'}
        onAction={audio.starting ? undefined : audio.retry}
      />
    )
  } else if (audio.status === 'limit') {
    body = (
      <ErrorCard
        title="You've reached today's limit for new Hinglish audio."
        message="Audio you already made still plays."
      />
    )
  } else {
    body = <ErrorCard title="Something went wrong." message={audio.error} actionLabel="Try again" onAction={audio.reload} />
  }

  return (
    <Box>
      {body}
      <Box srOnly role="status" aria-live="polite">
        {announcement}
      </Box>
    </Box>
  )
}
