// What the Download PDF button should say and whether it works. `counts` is the outline's
// { lessonsReady, lessonsFailed, lessonsTotal }; `activeExport` is { courseId, done, total } or null.
export function exportReadiness({ courseId, counts, activeExport }) {
  const { lessonsReady: ready, lessonsFailed: failed, lessonsTotal: total } = counts

  if (activeExport?.courseId === courseId) {
    const { done, total: exportTotal } = activeExport
    return {
      kind: 'exporting',
      enabled: false,
      label: `Exporting ${done}/${exportTotal}`,
      fullLabel: `Exporting the PDF, ${done} of ${exportTotal} lessons`,
    }
  }

  if (total === 0 || ready + failed < total) {
    return {
      kind: 'preparing',
      enabled: false,
      label: `Preparing ${ready}/${total}`,
      fullLabel: `Preparing… ${ready} of ${total} lessons ready`,
    }
  }

  if (failed > 0) {
    return {
      kind: 'failed',
      enabled: false,
      label: `${failed} failed`,
      fullLabel: failed === 1 ? '1 lesson failed, open it to retry' : `${failed} lessons failed, open them to retry`,
    }
  }

  if (activeExport) {
    return {
      kind: 'busy',
      enabled: false,
      label: 'Download PDF',
      fullLabel: "Another course's PDF is still exporting",
    }
  }

  return {
    kind: 'ready',
    enabled: true,
    label: 'Download PDF',
    fullLabel: 'Download this course as a PDF',
  }
}
