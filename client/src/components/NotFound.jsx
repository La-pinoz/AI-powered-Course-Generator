import { Link } from 'react-router-dom'

// Shown when a course, lesson or module doesn't exist (or belongs to someone else).
export default function NotFound({ what = 'Page' }) {
  return (
    <div className="card">
      <h1 className="text-2xl font-medium">{what} not found</h1>
      <Link to="/dashboard" className="btn btn-primary mt-6">
        Back to dashboard
      </Link>
    </div>
  )
}
