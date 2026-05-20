import { investigatorRoleLabel } from '@/lib/subject/visits/progress-note/types'
import { loadVisitCloseoutBundle } from '@/lib/subject/visits/progress-note/load'

export async function buildVisitCloseoutPdfLines(visitId: string): Promise<string[]> {
  const bundle = await loadVisitCloseoutBundle(visitId)
  if (!bundle) {
    return ['Visit closeout: not available']
  }

  const { model } = bundle
  const notePreview = model.noteText.trim()
    ? model.noteText.trim().slice(0, 500).replace(/\s+/g, ' ')
    : '(empty)'

  return [
    '',
    '--- Visit Closeout ---',
    `Review status: ${model.visitReviewStatus.replace(/_/g, ' ')}`,
    `Coordinator note: ${notePreview}`,
    `Coordinator signed: ${
      model.coordinatorSignedAt
        ? `${model.coordinatorSignedByName ?? ''} @ ${model.coordinatorSignedAt}`
        : 'No'
    }`,
    `Investigator signed: ${
      model.investigatorSignedAt
        ? `${model.investigatorSignedByName ?? ''} (${investigatorRoleLabel(model.investigatorRole)}) @ ${model.investigatorSignedAt}`
        : 'No'
    }`,
  ]
}
