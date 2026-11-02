import LessonRenderer from './LessonRenderer.jsx'

export default function ExplanationSection({ lesson }) {
  return <LessonRenderer content={lesson.content ?? []} />
}
