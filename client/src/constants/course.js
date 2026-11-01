// Keep the shared values identical to server/utils/courseConstants.js.
export const TOPIC_MIN = 2
export const TOPIC_MAX = 200
export const TOPIC_COUNTER_FROM = 180

export const LESSONS_PER_MODULE = { min: 3, max: 5 }

export const DEFAULT_DEPTH = 'standard'

export const DEPTHS = [
  { value: 'quick', label: 'Quick · 3 modules' },
  { value: 'standard', label: 'Standard · 4–5 modules' },
  { value: 'in-depth', label: 'In-depth · 6 modules' },
]

export const DEPTH_HELPER = `Each module has ${LESSONS_PER_MODULE.min}–${LESSONS_PER_MODULE.max} lessons.`

export const TOPIC_ERROR = `Topic name must be between ${TOPIC_MIN} and ${TOPIC_MAX} characters.`
