import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthedApi from '../../hooks/useAuthedApi.js'
import useCourses from '../../hooks/useCourses.js'
import { DEFAULT_DEPTH, DEPTH_HELPER, DEPTHS, TOPIC_ERROR, TOPIC_MAX, TOPIC_MIN } from '../../constants/course.js'
import { messageFor } from '../../utils/errorMessage.js'
import ErrorMessage from '../ErrorMessage.jsx'

// The prompt form: the user types a topic, picks a depth, and the server generates the course outline.
export default function CreateCourseForm() {
  const request = useAuthedApi()
  const { refreshCourses } = useCourses()
  const navigate = useNavigate()

  const [topic, setTopic] = useState('')
  const [depth, setDepth] = useState(DEFAULT_DEPTH)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmed = topic.trim()
    if (trimmed.length < TOPIC_MIN || trimmed.length > TOPIC_MAX) {
      setError(TOPIC_ERROR)
      return
    }

    setLoading(true)
    setError('')
    try {
      const data = await request('/courses', {
        method: 'POST',
        body: { topic: trimmed, depth },
      })
      refreshCourses()
      navigate(`/courses/${data.course._id}`)
    } catch (err) {
      setError(messageFor(err))
      setLoading(false)
    }
  }

  return (
    <section className="card" aria-labelledby="create-course-heading">
      <h2 id="create-course-heading" className="text-2xl font-medium">
        Create a new course
      </h2>
      <p className="mt-1 text-muted">Type any topic and AI will build a multi-module course for you.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 max-w-2xl space-y-6">
        <div>
          <label htmlFor="topic" className="mb-1 block font-semibold">
            Topic
          </label>
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. Intro to React Hooks"
            maxLength={TOPIC_MAX}
            disabled={loading}
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-white px-4 py-3 focus:border-accent focus:outline-none"
          />
        </div>

        <fieldset>
          <legend className="mb-2 font-semibold">Course depth</legend>
          <div className="flex flex-wrap gap-3">
            {DEPTHS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-4 py-2 has-checked:border-accent has-checked:bg-accent/10"
              >
                <input
                  type="radio"
                  name="depth"
                  value={option.value}
                  checked={depth === option.value}
                  onChange={() => setDepth(option.value)}
                  disabled={loading}
                  className="accent-accent"
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{DEPTH_HELPER}</p>
        </fieldset>

        {error && <ErrorMessage message={error} />}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Generating your course… (up to a minute)' : 'Generate course'}
        </button>
      </form>
    </section>
  )
}
