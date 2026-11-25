import { describe, expect, it } from 'vitest'
import { courseSteps, stepsAround } from '../src/utils/courseSteps.js'

const modules = [
  { _id: 'm1', order: 1, lessons: [{ _id: 'l1', title: 'One' }, { _id: 'l2', title: 'Two' }] },
  { _id: 'm2', order: 2, lessons: [{ _id: 'l3', title: 'Three' }] },
]

describe('courseSteps', () => {
  it("lists each module's video, then its lessons", () => {
    expect(courseSteps('c', modules).map((step) => step.key)).toEqual([
      'video-m1',
      'lesson-l1',
      'lesson-l2',
      'video-m2',
      'lesson-l3',
    ])
  })

  it('finds the previous and next step', () => {
    const { prev, next } = stepsAround(courseSteps('c', modules), 'lesson-l2')
    expect(prev.path).toBe('/courses/c/lessons/l1')
    expect(next.path).toBe('/courses/c/modules/m2/video')
  })

  it('has no next step at the end of the course', () => {
    expect(stepsAround(courseSteps('c', modules), 'lesson-l3').next).toBeNull()
  })
})
