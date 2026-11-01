const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const formatCreatedDate = (iso) => dateFormatter.format(new Date(iso))

// pluralize(1, 'course') → '1 course', pluralize(3, 'course') → '3 courses'
export const pluralize = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`

// '3 courses • 13 of 49 lessons completed' ('1 of 1 lesson completed' for a single lesson)
export const statsLine = ({ courseCount, completedLessonCount, lessonCount }) =>
  `${pluralize(courseCount, 'course')} • ${completedLessonCount} of ${pluralize(lessonCount, 'lesson')} completed`

export const courseMeta = ({ moduleCount, lessonCount, createdAt }) =>
  `${moduleCount} Modules • ${lessonCount} Lessons • Created ${formatCreatedDate(createdAt)}`
