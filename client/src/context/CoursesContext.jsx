import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMatch } from 'react-router-dom'
import useAuthedApi from '../hooks/useAuthedApi.js'
import { toaster } from '../components/dashboard/toaster.js'
import { CoursesContext } from './coursesContext.js'

// Recomputes the readiness counts the outline endpoint returns after a lesson status changes.
const withCounts = (data) => {
  const all = data.modules.flatMap((m) => m.lessons)
  return {
    ...data,
    lessonsReady: all.filter((l) => l.status === 'ready').length,
    lessonsFailed: all.filter((l) => l.status === 'failed').length,
    lessonsTotal: all.length,
  }
}

// Applies `change(lesson)` to every lesson of an outline; returns the new outline data.
const mapLessons = (data, change) =>
  withCounts({
    ...data,
    modules: data.modules.map((m) => ({ ...m, lessons: m.lessons.map(change) })),
  })

// Single source of truth for the sidebar tree and the Continue Learning cards.
// Also owns the tree's expand/collapse state, which lives for as long as the dashboard layout.
export function CoursesProvider({ children }) {
  const request = useAuthedApi()

  const [courses, setCourses] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null)
  // courseId → { status: 'loading' | 'ready' | 'error', data?: outline course, error?: string }
  const [outlines, setOutlines] = useState({})
  const outlinesRef = useRef({})
  // lessonId → ready lesson (with its content), so going back to a lesson you read is instant.
  const [lessons, setLessons] = useState({})

  const [expandedCourses, setExpandedCourses] = useState(() => new Set())
  const [expandedModules, setExpandedModules] = useState(() => new Set())

  const courseMatch = useMatch('/courses/:courseId/*')
  const lessonMatch = useMatch('/courses/:courseId/lessons/:lessonId')
  const routeCourseId = courseMatch?.params.courseId ?? null
  const routeLessonId = lessonMatch?.params.lessonId ?? null

  const stats = useMemo(
    () => ({
      courseCount: courses.length,
      lessonCount: courses.reduce((sum, c) => sum + c.lessonCount, 0),
      completedLessonCount: courses.reduce((sum, c) => sum + c.completedLessonCount, 0),
    }),
    [courses],
  )

  const fetchCourses = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const data = await request('/courses')
      setCourses(data.courses)
      setStatus('ready')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }, [request])

  // Guards React StrictMode's double mount so the list is requested once.
  const hasFetchedCourses = useRef(false)
  useEffect(() => {
    if (hasFetchedCourses.current) return
    hasFetchedCourses.current = true
    fetchCourses()
  }, [fetchCourses])

  const setOutline = useCallback((courseId, value) => {
    outlinesRef.current = { ...outlinesRef.current, [courseId]: value }
    setOutlines(outlinesRef.current)
  }, [])

  // Fetches a course's modules and lessons the first time it is needed, then serves the cache.
  const fetchOutline = useCallback(
    async (courseId) => {
      const current = outlinesRef.current[courseId]
      if (current && current.status !== 'error') return
      setOutline(courseId, { status: 'loading' })
      try {
        const data = await request(`/courses/${courseId}/outline`)
        setOutline(courseId, { status: 'ready', data: data.course })
      } catch (err) {
        setOutline(courseId, { status: 'error', error: err.message })
      }
    },
    [request, setOutline],
  )

  const addCourse = useCallback((course) => {
    setCourses((prev) => [course, ...prev.filter((c) => c._id !== course._id)])
  }, [])

  const removeCourse = useCallback((courseId) => {
    setCourses((prev) => prev.filter((c) => c._id !== courseId))
    const rest = { ...outlinesRef.current }
    delete rest[courseId]
    outlinesRef.current = rest
    setOutlines(rest)
    setLessons((prev) => Object.fromEntries(Object.entries(prev).filter(([, l]) => l.courseId !== courseId)))
  }, [])

  const createCourse = useCallback(
    async (payload) => {
      const data = await request('/courses', { method: 'POST', body: payload })
      addCourse(data.course)
      return data.course
    },
    [request, addCourse],
  )

  const deleteCourse = useCallback(
    async (courseId) => {
      await request(`/courses/${courseId}`, { method: 'DELETE' })
      removeCourse(courseId)
    },
    [request, removeCourse],
  )

  // --- Lessons --------------------------------------------------------------------------------

  const cacheLesson = useCallback((lesson) => {
    setLessons((prev) => ({ ...prev, [lesson.id]: lesson }))
  }, [])

  // Keeps the outline's per-lesson status (and the ready / failed / total counts) fresh.
  const setLessonStatus = useCallback(
    (courseId, lessonId, status) => {
      const outline = outlinesRef.current[courseId]
      if (outline?.status !== 'ready') return
      const current = outline.data.modules.flatMap((m) => m.lessons).find((l) => l._id === lessonId)
      if (!current || current.status === status) return
      setOutline(courseId, {
        status: 'ready',
        data: mapLessons(outline.data, (l) => (l._id === lessonId ? { ...l, status } : l)),
      })
    },
    [setOutline],
  )

  // Flips the completed flag in the outline and adjusts the course's count. Returns whether anything
  // changed, so callers can roll back exactly what they did.
  const applyCompleted = useCallback(
    (courseId, lessonId, completed) => {
      const outline = outlinesRef.current[courseId]
      if (outline?.status !== 'ready') return false
      const current = outline.data.modules.flatMap((m) => m.lessons).find((l) => l._id === lessonId)
      if (!current || current.completed === completed) return false
      setOutline(courseId, {
        status: 'ready',
        data: mapLessons(outline.data, (l) => (l._id === lessonId ? { ...l, completed } : l)),
      })
      setCourses((prev) =>
        prev.map((c) =>
          c._id === courseId
            ? { ...c, completedLessonCount: Math.max(0, c.completedLessonCount + (completed ? 1 : -1)) }
            : c,
        ),
      )
      return true
    },
    [setOutline],
  )

  // Replaces the optimistic numbers with what the server says.
  const reconcileProgress = useCallback(
    (courseId, progress) => {
      const done = new Set(progress.completedLessonIds)
      const outline = outlinesRef.current[courseId]
      if (outline?.status === 'ready') {
        setOutline(courseId, {
          status: 'ready',
          data: {
            ...mapLessons(outline.data, (l) => ({ ...l, completed: done.has(l._id) })),
            currentLessonId: progress.currentLessonId,
          },
        })
      }
      setCourses((prev) =>
        prev.map((c) =>
          c._id === courseId
            ? {
                ...c,
                completedLessonCount: progress.completedLessonCount,
                currentLessonId: progress.currentLessonId,
              }
            : c,
        ),
      )
    },
    [setOutline],
  )

  // Optimistic: the sidebar tick, card progress and stats line update at once, and roll back with a
  // toast if the request fails. Resolves to whether it worked.
  const setLessonCompleted = useCallback(
    async (courseId, lessonId, completed) => {
      const changed = applyCompleted(courseId, lessonId, completed)
      try {
        const data = await request(`/courses/${courseId}/progress`, {
          method: 'PATCH',
          body: { lessonId, completed },
        })
        reconcileProgress(courseId, data.progress)
        return true
      } catch (err) {
        if (changed) applyCompleted(courseId, lessonId, !completed)
        toaster.create({
          title: completed ? "Couldn't mark the lesson as completed" : "Couldn't undo completion",
          description: err.message,
          type: 'error',
          closable: true,
        })
        return false
      }
    },
    [request, applyCompleted, reconcileProgress],
  )

  // Makes a lesson the course's resume point (Continue Learning), quietly, in the background.
  const setCurrentLesson = useCallback(
    async (courseId, lessonId) => {
      const setCurrent = (id) => {
        setCourses((prev) => prev.map((c) => (c._id === courseId ? { ...c, currentLessonId: id } : c)))
        const outline = outlinesRef.current[courseId]
        if (outline?.status === 'ready') {
          setOutline(courseId, { status: 'ready', data: { ...outline.data, currentLessonId: id } })
        }
      }
      const previous = outlinesRef.current[courseId]?.data?.currentLessonId ?? null
      setCurrent(lessonId)
      try {
        const data = await request(`/courses/${courseId}/progress`, {
          method: 'PATCH',
          body: { lessonId, makeCurrent: true },
        })
        reconcileProgress(courseId, data.progress)
      } catch {
        setCurrent(previous)
      }
    },
    [request, setOutline, reconcileProgress],
  )

  // --- Tree expansion -------------------------------------------------------------------------

  const toggleCourse = useCallback(
    (courseId) => {
      setExpandedCourses((prev) => {
        const next = new Set(prev)
        if (next.has(courseId)) next.delete(courseId)
        else next.add(courseId)
        return next
      })
      fetchOutline(courseId)
    },
    [fetchOutline],
  )

  const toggleModule = useCallback((moduleId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }, [])

  // The lesson shown as "current" for a course: the open lesson on its own lesson route,
  // otherwise the course's resume point.
  const getCurrentLessonId = useCallback(
    (course) =>
      routeCourseId === course._id && routeLessonId ? routeLessonId : course.currentLessonId,
    [routeCourseId, routeLessonId],
  )

  // Default expansion. Runs once when the list first loads (first course, or the course in the URL)
  // and again whenever the URL moves to a different course. Later clicks are never overridden.
  const pendingModuleFor = useRef(new Set())
  const appliedRouteCourse = useRef(null)
  const appliedInitial = useRef(false)

  useEffect(() => {
    let target = null
    if (routeCourseId && appliedRouteCourse.current !== routeCourseId) {
      appliedRouteCourse.current = routeCourseId
      appliedInitial.current = true
      target = routeCourseId
    } else if (!routeCourseId && !appliedInitial.current && status === 'ready') {
      appliedInitial.current = true
      target = courses[0]?._id ?? null
    } else if (!routeCourseId) {
      appliedRouteCourse.current = null
    }
    if (!target) return
    setExpandedCourses((prev) => new Set(prev).add(target))
    pendingModuleFor.current.add(target)
    fetchOutline(target)
  }, [routeCourseId, status, courses, fetchOutline])

  // Once an outline has arrived, open the module that holds the current lesson (or Module 1).
  useEffect(() => {
    const toOpen = []
    for (const courseId of pendingModuleFor.current) {
      const outline = outlines[courseId]
      if (outline?.status !== 'ready') continue
      pendingModuleFor.current.delete(courseId)
      const { modules, currentLessonId } = outline.data
      const lessonId = routeCourseId === courseId && routeLessonId ? routeLessonId : currentLessonId
      const holder =
        modules.find((m) => m.lessons.some((l) => l._id === lessonId)) ?? modules[0]
      if (holder) toOpen.push(holder._id)
    }
    // Opening a lesson by URL (e.g. a pasted link) should also reveal it in the tree.
    const routeOutline = routeCourseId && outlines[routeCourseId]
    if (routeLessonId && routeOutline?.status === 'ready') {
      const holder = routeOutline.data.modules.find((m) =>
        m.lessons.some((l) => l._id === routeLessonId),
      )
      if (holder) toOpen.push(holder._id)
    }
    if (toOpen.length > 0) {
      setExpandedModules((prev) => {
        if (toOpen.every((id) => prev.has(id))) return prev
        const next = new Set(prev)
        toOpen.forEach((id) => next.add(id))
        return next
      })
    }
  }, [outlines, routeCourseId, routeLessonId])

  const value = useMemo(
    () => ({
      courses,
      stats,
      status,
      error,
      outlines,
      lessons,
      routeCourseId,
      routeLessonId,
      expandedCourses,
      expandedModules,
      fetchCourses,
      fetchOutline,
      createCourse,
      addCourse,
      deleteCourse,
      removeCourse,
      toggleCourse,
      toggleModule,
      getCurrentLessonId,
      cacheLesson,
      setLessonStatus,
      setLessonCompleted,
      setCurrentLesson,
    }),
    [
      courses,
      stats,
      status,
      error,
      outlines,
      lessons,
      routeCourseId,
      routeLessonId,
      expandedCourses,
      expandedModules,
      fetchCourses,
      fetchOutline,
      createCourse,
      addCourse,
      deleteCourse,
      removeCourse,
      toggleCourse,
      toggleModule,
      getCurrentLessonId,
      cacheLesson,
      setLessonStatus,
      setLessonCompleted,
      setCurrentLesson,
    ],
  )

  return <CoursesContext.Provider value={value}>{children}</CoursesContext.Provider>
}
