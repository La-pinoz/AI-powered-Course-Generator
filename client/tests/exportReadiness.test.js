import { describe, expect, it } from 'vitest'
import { exportReadiness } from '../src/utils/coursePdf/exportReadiness.js'

const counts = (lessonsReady, lessonsFailed, lessonsTotal) => ({ lessonsReady, lessonsFailed, lessonsTotal })

describe('exportReadiness', () => {
  it('is disabled with a count while lessons are being written', () => {
    expect(exportReadiness({ courseId: 'a', counts: counts(12, 0, 22), activeExport: null })).toEqual({
      kind: 'preparing',
      enabled: false,
      label: 'Preparing 12/22',
      fullLabel: 'Preparing… 12 of 22 lessons ready',
    })
  })

  it('shows preparing rather than failed while any lesson is still in progress', () => {
    const state = exportReadiness({ courseId: 'a', counts: counts(10, 2, 22), activeExport: null })
    expect(state.kind).toBe('preparing')
    expect(state.label).toBe('Preparing 10/22')
  })

  it('is disabled and asks for a retry once only failed lessons remain', () => {
    expect(exportReadiness({ courseId: 'a', counts: counts(20, 2, 22), activeExport: null })).toEqual({
      kind: 'failed',
      enabled: false,
      label: '2 failed',
      fullLabel: '2 lessons failed, open them to retry',
    })
  })

  it('uses singular wording for one failed lesson', () => {
    const state = exportReadiness({ courseId: 'a', counts: counts(21, 1, 22), activeExport: null })
    expect(state.label).toBe('1 failed')
    expect(state.fullLabel).toBe('1 lesson failed, open it to retry')
  })

  it('is enabled when every lesson is ready', () => {
    expect(exportReadiness({ courseId: 'a', counts: counts(22, 0, 22), activeExport: null })).toEqual({
      kind: 'ready',
      enabled: true,
      label: 'Download PDF',
      fullLabel: 'Download this course as a PDF',
    })
  })

  it('is not ready for a course with no lessons', () => {
    const state = exportReadiness({ courseId: 'a', counts: counts(0, 0, 0), activeExport: null })
    expect(state.enabled).toBe(false)
  })

  it('shows progress while this course is exporting', () => {
    const activeExport = { courseId: 'a', done: 5, total: 22 }
    expect(exportReadiness({ courseId: 'a', counts: counts(22, 0, 22), activeExport })).toEqual({
      kind: 'exporting',
      enabled: false,
      label: 'Exporting 5/22',
      fullLabel: 'Exporting the PDF, 5 of 22 lessons',
    })
  })

  it("is unavailable while another course's PDF is exporting", () => {
    const activeExport = { courseId: 'b', done: 1, total: 9 }
    expect(exportReadiness({ courseId: 'a', counts: counts(22, 0, 22), activeExport })).toEqual({
      kind: 'busy',
      enabled: false,
      label: 'Download PDF',
      fullLabel: "Another course's PDF is still exporting",
    })
  })

  it('still reports its own preparing state while another course exports', () => {
    const activeExport = { courseId: 'b', done: 1, total: 9 }
    const state = exportReadiness({ courseId: 'a', counts: counts(3, 0, 22), activeExport })
    expect(state.kind).toBe('preparing')
  })
})
