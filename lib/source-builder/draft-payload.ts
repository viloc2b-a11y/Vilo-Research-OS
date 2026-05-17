import type { SourceBuilderDraft } from './types'

export type SourceBuilderDraftPayload = {
  visits: SourceBuilderDraft['visits']
  procedures: SourceBuilderDraft['procedures']
  matrix: SourceBuilderDraft['matrix']
  version: number
  protocolNickname: string
  description: string
}

export function buildDraftPayload(draft: SourceBuilderDraft): SourceBuilderDraftPayload {
  return {
    visits: draft.visits,
    procedures: draft.procedures,
    matrix: draft.matrix,
    version: draft.version,
    protocolNickname: draft.protocolNickname,
    description: draft.description,
  }
}

export function validateDraftPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'draft_payload must be an object'
  }
  const p = payload as Record<string, unknown>
  if (!Array.isArray(p.visits)) return 'draft_payload must include visits[]'
  if (!Array.isArray(p.procedures)) return 'draft_payload must include procedures[]'
  const matrix = p.matrix ?? p.matrixRows
  if (!Array.isArray(matrix)) return 'draft_payload must include matrix[] (or matrixRows[])'
  return null
}

export function payloadToDraftParts(payload: Record<string, unknown>): Pick<
  SourceBuilderDraft,
  'visits' | 'procedures' | 'matrix' | 'version' | 'protocolNickname' | 'description'
> {
  const matrix = (payload.matrix ?? payload.matrixRows) as SourceBuilderDraft['matrix']
  return {
    visits: (payload.visits as SourceBuilderDraft['visits']) ?? [],
    procedures: (payload.procedures as SourceBuilderDraft['procedures']) ?? [],
    matrix: matrix ?? [],
    version: typeof payload.version === 'number' ? payload.version : 0,
    protocolNickname:
      typeof payload.protocolNickname === 'string' ? payload.protocolNickname : '',
    description: typeof payload.description === 'string' ? payload.description : '',
  }
}
