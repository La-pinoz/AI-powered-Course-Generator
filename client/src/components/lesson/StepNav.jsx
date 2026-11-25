import { Link } from 'react-router-dom'

// Previous / Next through the course (module videos and lessons). `prev` and `next` come from
// stepsAround() in utils/courseSteps.js and are { path, label } or null.
export default function StepNav({ prev, next, endPath }) {
  return (
    <nav aria-label="Course navigation" className="flex flex-col gap-3 sm:flex-row sm:justify-between">
      {prev ? (
        <Link to={prev.path} className="btn btn-secondary">
          ← {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={next.path} className="btn btn-secondary">
          {next.label} →
        </Link>
      )}
      {!next && endPath && (
        <Link to={endPath} className="btn btn-secondary">
          Back to course →
        </Link>
      )}
    </nav>
  )
}
