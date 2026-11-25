import { Link, NavLink } from 'react-router-dom'
import useCourses from '../../hooks/useCourses.js'
import { lessonPath, moduleVideoPath } from '../../utils/courseSteps.js'

// One link in the sidebar. NavLink knows when its page is open, so we highlight it.
function SideLink({ to, onClick, children, small = false }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg px-3 py-2 ${small ? 'text-sm' : 'font-medium'} ${
          isActive ? 'bg-accent/10 text-brand' : 'text-ink hover:bg-line/60'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

// The open course's modules: each module's video, then its lessons (✓ when completed).
function CourseOutline({ courseId, outline, onNavigate }) {
  return (
    <ul className="mt-1 mb-2 space-y-3 border-l border-line pl-3">
      {outline.modules.map((module) => (
        <li key={module._id}>
          <p className="px-3 text-xs font-semibold tracking-wide text-muted uppercase">
            Module {module.order}: {module.title}
          </p>
          <ul className="mt-1">
            <li>
              <SideLink to={moduleVideoPath(courseId, module._id)} onClick={onNavigate} small>
                ▶ Module video
              </SideLink>
            </li>
            {module.lessons.map((lesson) => (
              <li key={lesson._id}>
                <SideLink to={lessonPath(courseId, lesson._id)} onClick={onNavigate} small>
                  <span className="w-4 shrink-0 text-success">{lesson.completed ? '✓' : ''}</span>
                  <span className="truncate">
                    {lesson.order}. {lesson.title}
                  </span>
                </SideLink>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

// Always visible from 768px up. Below that it slides over the page when `open` is true, and any link
// click closes it.
export default function Sidebar({ open, onClose }) {
  const { courses, courseId, outline } = useCourses()

  return (
    <>
      {/* Dark backdrop behind the open sidebar on small screens; clicking it closes the sidebar. */}
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`${open ? 'fixed' : 'hidden'} inset-y-0 left-0 z-40 w-72 overflow-y-auto border-r border-line bg-white p-4 md:sticky md:top-0 md:block md:h-dvh md:shrink-0`}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link to="/dashboard" onClick={onClose} className="text-lg leading-tight font-bold">
            AI-Powered
            <br />
            Course Generator ✳
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-2 text-xl leading-none hover:bg-line md:hidden"
          >
            ✕
          </button>
        </div>

        <nav aria-label="Main">
          <SideLink to="/dashboard" onClick={onClose}>
            Dashboard
          </SideLink>

          <p className="mt-6 mb-2 px-3 text-xs font-semibold tracking-wide text-muted uppercase">My courses</p>
          {courses.length === 0 && <p className="px-3 text-sm text-muted">No courses yet.</p>}
          <ul className="space-y-1">
            {courses.map((course) => (
              <li key={course._id}>
                <SideLink to={`/courses/${course._id}`} onClick={onClose}>
                  <span className="truncate">{course.title}</span>
                </SideLink>
                {course._id === courseId && outline && (
                  <CourseOutline courseId={courseId} outline={outline} onNavigate={onClose} />
                )}
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
