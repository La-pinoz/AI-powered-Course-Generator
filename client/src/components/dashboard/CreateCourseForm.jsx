import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Heading, Stack, Text } from '@chakra-ui/react'
import useCourses from '../../hooks/useCourses.js'
import { DEFAULT_DEPTH, TOPIC_MAX, TOPIC_MIN } from '../../constants/course.js'
import TopicInput from './TopicInput.jsx'
import DepthSelector from './DepthSelector.jsx'
import FeatureToggles from './FeatureToggles.jsx'
import GenerateStatus from './GenerateStatus.jsx'

const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.'

const isValidTopic = (topic) => {
  const length = topic.trim().length
  return length >= TOPIC_MIN && length <= TOPIC_MAX
}

// fetch() rejects with a TypeError when the server can't be reached; Auth0 errors carry `.error`.
const messageFor = (err) => {
  if (err instanceof TypeError) return NETWORK_ERROR
  if (err?.error) return 'Please log in again.'
  return err?.message || 'Something went wrong. Please try again.'
}

// States: idle → (invalid submit) validation → idle | loading → (success) navigate | api error.
// `phase` is idle | loading | error; the validation message is a separate flag that is never
// shown together with the loading bar or the API error.
export default function CreateCourseForm() {
  const { createCourse } = useCourses()
  const navigate = useNavigate()

  const [topic, setTopic] = useState('')
  const [depth, setDepth] = useState(DEFAULT_DEPTH)
  const [sideQuest, setSideQuest] = useState(false)
  const [hinglishAudio, setHinglishAudio] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [showValidation, setShowValidation] = useState(false)
  const [apiError, setApiError] = useState('')

  const inputRef = useRef(null)
  const inFlight = useRef(false)
  const lastPayload = useRef(null)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Editing any field dismisses an API error.
  const dismissError = () => {
    if (phase === 'error') setPhase('idle')
  }

  const handleTopicChange = (value) => {
    setTopic(value)
    // Once the message is showing, it re-checks on every keystroke and clears when valid.
    if (showValidation) setShowValidation(!isValidTopic(value))
    dismissError()
  }

  const send = async (payload) => {
    if (inFlight.current) return
    inFlight.current = true
    lastPayload.current = payload
    setApiError('')
    setPhase('loading')
    try {
      const course = await createCourse(payload)
      // The user may have navigated away while this ran; the course is already in the list.
      if (mounted.current) navigate(`/courses/${course._id}`)
    } catch (err) {
      if (mounted.current) {
        setApiError(messageFor(err))
        setPhase('error')
      }
    } finally {
      inFlight.current = false
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (inFlight.current) return
    if (!isValidTopic(topic)) {
      setShowValidation(true)
      inputRef.current?.focus()
      return
    }
    setShowValidation(false)
    send({ topic: topic.trim(), depth, sideQuest, hinglishAudio })
  }

  const loading = phase === 'loading'

  return (
    <Box
      as="section"
      aria-labelledby="create-course-heading"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.subtle"
      rounded="2xl"
      p={{ base: '4', md: '8' }}
    >
      <Heading as="h2" id="create-course-heading" size="2xl" fontWeight="medium" letterSpacing="tight">
        Create a New Course
      </Heading>
      <Text mt="1" color="text.muted">
        Generate a custom, multi-module course instantly using AI.
      </Text>

      {/* max-w-2xl: the input and the Generate button share this width. */}
      <Box as="form" onSubmit={handleSubmit} noValidate maxW="2xl">
        <Stack gap="7" mt="8">
          <TopicInput
            value={topic}
            onChange={handleTopicChange}
            invalid={showValidation && !loading && phase !== 'error'}
            disabled={loading}
            inputRef={inputRef}
          />
          <DepthSelector
            value={depth}
            onChange={(value) => {
              setDepth(value)
              dismissError()
            }}
            disabled={loading}
          />
          <FeatureToggles
            sideQuest={sideQuest}
            hinglishAudio={hinglishAudio}
            onSideQuestChange={(value) => {
              setSideQuest(value)
              dismissError()
            }}
            onHinglishChange={(value) => {
              setHinglishAudio(value)
              dismissError()
            }}
            disabled={loading}
          />
          <GenerateStatus
            phase={phase}
            errorMessage={apiError}
            onTryAgain={() => send(lastPayload.current)}
          />
        </Stack>
      </Box>
    </Box>
  )
}
