import ExplanationSection from './ExplanationSection.jsx'
import QuizSection from './QuizSection.jsx'
import HinglishAudioSection from './HinglishAudioSection.jsx'

const quizCount = (lesson) => (lesson.content ?? []).filter((block) => block.type === 'mcq').length

// The lesson page's collapsible sections, in order. A later session adds a section by adding one
// entry here and one component; nothing else on the page changes.
// `isVisible` and a function `subtitle` receive { lesson, course }; `Component` receives the same.
export const lessonSections = [
  {
    id: 'explanation',
    title: 'Explanation',
    isVisible: () => true,
    Component: ExplanationSection,
  },
  {
    id: 'quiz',
    title: 'Quiz',
    subtitle: ({ lesson }) => `${quizCount(lesson)} questions · self-check`,
    isVisible: () => true,
    Component: QuizSection,
  },
  {
    id: 'hinglish-audio',
    title: 'Hinglish audio',
    subtitle: 'Listen to this lesson explained in Hinglish',
    isVisible: ({ course }) => Boolean(course.options?.hinglishAudio),
    Component: HinglishAudioSection,
  },
]
