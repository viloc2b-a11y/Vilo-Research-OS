import type {
  EdcStatus,
  QcStatus,
  ReviewStatus,
  SourceStatus,
  VisitGridStatus,
} from '@/lib/subject/visits/types'

type ResponseSetLite = { status: string }
type ProcedureLite = { execution_status: string }

export function mapVisitStatusForGrid(raw: string): VisitGridStatus {
  switch (raw) {
    case 'checked_in':
    case 'in_progress':
      return 'in_progress'
    case 'completed':
    case 'locked':
      return 'completed'
    case 'no_show':
    case 'missed':
      return 'missed'
    case 'out_of_window':
      return 'out_of_window'
    case 'cancelled':
      return 'cancelled'
    case 'confirmed':
      return 'confirmed'
    default:
      return 'scheduled'
  }
}

export function deriveSourceStatus(sets: ResponseSetLite[]): SourceStatus {
  if (sets.length === 0) return 'not_started'
  const statuses = sets.map((s) => s.status)
  if (statuses.every((s) => s === 'signed' || s === 'locked')) return 'signed'
  if (statuses.some((s) => s === 'corrected' || s === 'addended')) return 'corrected'
  if (
    statuses.some((s) =>
      ['submitted', 'pending_review', 'reviewed'].includes(s),
    )
  ) {
    return 'submitted'
  }
  if (statuses.some((s) => s === 'draft' || s === 'in_progress')) return 'draft'
  return 'not_started'
}

export function deriveEdcStatus(sets: ResponseSetLite[]): EdcStatus {
  if (sets.length === 0) return 'pending'
  if (
    sets.some((s) =>
      ['submitted', 'pending_review', 'reviewed', 'signed', 'locked'].includes(
        s.status,
      ),
    )
  ) {
    return 'verified'
  }
  if (sets.some((s) => s.status === 'draft' || s.status === 'in_progress')) return 'entered'
  return 'pending'
}

export function deriveQcStatus(procedures: ProcedureLite[]): QcStatus {
  if (procedures.length === 0) return 'pending'
  if (procedures.every((p) => p.execution_status === 'verified')) return 'verified'
  if (
    procedures.some((p) =>
      ['completed', 'verified'].includes(p.execution_status),
    )
  ) {
    return 'entered'
  }
  return 'pending'
}

export function deriveReviewStatus(sets: ResponseSetLite[]): ReviewStatus {
  if (sets.length === 0) return 'pending'
  if (sets.every((s) => ['reviewed', 'signed', 'locked'].includes(s.status))) {
    return 'complete'
  }
  if (
    sets.some((s) =>
      ['submitted', 'pending_review', 'reviewed'].includes(s.status),
    )
  ) {
    return 'in_review'
  }
  return 'pending'
}

export function pickOperationalStatus<T extends string>(
  stored: T | null | undefined,
  derived: T,
  defaultValue: T,
): T {
  if (stored && stored !== defaultValue) return stored
  return derived
}
