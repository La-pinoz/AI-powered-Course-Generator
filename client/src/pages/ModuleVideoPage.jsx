import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Button, Flex, Heading, Skeleton, Text, VisuallyHidden } from '@chakra-ui/react'
import useCourses from '../hooks/useCourses.js'
import useModuleVideo from '../hooks/useModuleVideo.js'
import PillButton from '../components/dashboard/PillButton.jsx'
import { toaster } from '../components/dashboard/toaster.js'
import StepNav from '../components/lesson/StepNav.jsx'
import VideoPlayer from '../components/video/VideoPlayer.jsx'
import VideoStatusCard from '../components/video/VideoStatusCard.jsx'
import { courseSteps, lessonPath, stepsAround } from '../utils/courseSteps.js'

const formatLength = (seconds) => {
  if (!Number.isFinite(seconds)) return null
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
}

// /courses/:courseId/modules/:moduleId/video. Not a lesson: it never touches progress, the resume point
// or the lesson counts. "Start Lesson 1" is its Next action, so the nav row only shows Previous.
export default function ModuleVideoPage() {
  const { courseId, moduleId } = useParams()
  const { courses, status: coursesStatus, outlines, fetchOutline } = useCourses()
  const { status, approved, selectedVideoId, canSearchAgain, error, retry, selectVideo, reportUnavailable, reload } =
    useModuleVideo(courseId, moduleId)
  const headingRef = useRef(null)
  const [switching, setSwitching] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    fetchOutline(courseId)
  }, [courseId, fetchOutline])

  const outline = outlines[courseId]
  const outlineReady = outline?.status === 'ready'
  const module = outlineReady ? outline.data.modules.find((m) => m._id === moduleId) : null

  const { prev } = useMemo(
    () =>
      outlineReady
        ? stepsAround(courseSteps(courseId, outline.data.modules), `video-${moduleId}`)
        : { prev: null },
    [outlineReady, outline, courseId, moduleId],
  )

  // New module: back to the top, and focus its heading once it has rendered.
  const focusedFor = useRef(null)
  const moduleKnown = Boolean(module)
  useEffect(() => {
    if (!moduleKnown || focusedFor.current === moduleId) return
    focusedFor.current = moduleId
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [moduleKnown, moduleId])

  // Says when a search the learner waited for has finished.
  const previousStatus = useRef(status)
  useEffect(() => {
    if (previousStatus.current === 'searching' && status === 'ready') setAnnouncement('Video ready.')
    previousStatus.current = status
  }, [status])

  const handleUnavailable = useCallback(
    async (videoId) => {
      try {
        const body = await reportUnavailable(videoId)
        setAnnouncement(
          body.status === 'ready'
            ? "That video isn't available. Showing another."
            : 'No suitable video found for this module.',
        )
      } catch {
        toaster.create({ title: "That video isn't available", description: 'Please try another video.', type: 'error', closable: true })
      }
    },
    [reportUnavailable],
  )

  const selectedIndex = approved.findIndex((v) => v.videoId === selectedVideoId)
  const video = approved[selectedIndex] ?? null

  const showAnother = async () => {
    const nextVideo = approved[(selectedIndex + 1) % approved.length]
    setSwitching(true)
    try {
      await selectVideo(nextVideo.videoId)
    } catch (err) {
      toaster.create({ title: "Couldn't change the video", description: err.message, type: 'error', closable: true })
    } finally {
      setSwitching(false)
    }
  }

  const notFound =
    status === 'notFound' ||
    (coursesStatus === 'ready' && !courses.some((c) => c._id === courseId)) ||
    (outlineReady && !module)

  if (notFound) {
    return (
      <Box maxW="760px" mx="auto" pb="8">
        <VideoStatusCard kind="notFound" />
      </Box>
    )
  }

  if (outline?.status === 'error') {
    return (
      <Box maxW="760px" mx="auto" pb="8">
        <VideoStatusCard kind="error" message={outline.error} onRetry={() => fetchOutline(courseId)} />
      </Box>
    )
  }

  const firstLesson = module?.lessons[0]
  const retryAction = status === 'error' ? reload : retry

  return (
    <Box maxW="760px" mx="auto" pb="8">
      <Box as="header">
        {module ? (
          <>
            <Text fontSize="sm" color="text.muted">
              Module {module.order} video
            </Text>
            <Heading
              as="h2"
              ref={headingRef}
              tabIndex={-1}
              mt="1"
              size={{ base: '2xl', md: '3xl' }}
              fontWeight="medium"
              letterSpacing="tight"
              _focusVisible={{ outline: 'none' }}
            >
              {module.title}
            </Heading>
          </>
        ) : (
          <>
            <Skeleton h="4" w="30%" />
            <Skeleton h="9" w="70%" mt="3" />
          </>
        )}
      </Box>

      <Box mt="6">
        {status === 'ready' && video ? (
          <>
            <VideoPlayer key={video.videoId} video={video} onUnavailable={handleUnavailable} />
            <Text mt="4" fontWeight="medium">
              {video.title}
            </Text>
            <Text color="text.muted" fontSize="sm">
              {[video.channelTitle, formatLength(video.durationSec)].filter(Boolean).join(' · ')} · YouTube
            </Text>
          </>
        ) : (
          <VideoStatusCard
            kind={status === 'ready' ? 'none' : status}
            message={error}
            canSearchAgain={canSearchAgain}
            onRetry={retryAction}
          />
        )}
      </Box>

      <Flex mt="6" gap="3" wrap="wrap" align="center">
        {firstLesson && (
          <PillButton to={lessonPath(courseId, firstLesson._id)}>Start Lesson 1</PillButton>
        )}
        {status === 'ready' && approved.length > 1 && (
          <Button
            type="button"
            variant="outline"
            borderColor="border.emphasized"
            minH="44px"
            disabled={switching}
            onClick={showAnother}
          >
            Show another video
          </Button>
        )}
      </Flex>

      {/* Persistent so the screen reader announces each change. */}
      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>

      <StepNav prev={prev} next={null} />
    </Box>
  )
}
