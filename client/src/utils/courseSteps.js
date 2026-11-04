export const moduleVideoPath = (courseId, moduleId) => `/courses/${courseId}/modules/${moduleId}/video`
export const lessonPath = (courseId, lessonId) => `/courses/${courseId}/lessons/${lessonId}`

// The Previous / Next order: each module's video, then its lessons. Lessons alone still drive progress.
export function courseSteps(courseId, modules) {
  return modules.flatMap((module) => [
    {
      key: `video-${module._id}`,
      path: moduleVideoPath(courseId, module._id),
      label: `Module ${module.order} video`,
    },
    ...module.lessons.map((lesson) => ({
      key: `lesson-${lesson._id}`,
      path: lessonPath(courseId, lesson._id),
      label: lesson.title,
    })),
  ])
}

// { prev, next } around one step, each a step or null.
export function stepsAround(steps, key) {
  const index = steps.findIndex((step) => step.key === key)
  if (index === -1) return { prev: null, next: null }
  return { prev: steps[index - 1] ?? null, next: steps[index + 1] ?? null }
}
