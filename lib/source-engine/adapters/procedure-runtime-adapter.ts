/**
 * Maps procedure execution / visit capture context → Phase 1 RuntimeContext.
 */

import type { CaptureProcedureContext } from '@/lib/source/capture/types'
import type { ProcedureCaptureContextRow } from '@/lib/source/capture/context'
import type {
  RuntimeContext,
  SignatureState,
  UserRole,
  VisitType,
} from '@/lib/source-engine/runtime/runtime-context'

export type ProcedureCaptureBridge = {
  procedureExecutionId: string
  organizationId?: string
  studyId: string
  studyVersionId: string | null
  siteId?: string
  studySubjectId: string
  visitId: string
  visitName?: string
  visitType?: VisitType | string
  visitDate?: string
  scheduledDate?: string
  country?: string
  timezone?: string
  arm?: string
  cohort?: string
  phase?: string
  isScreening?: boolean
  isTreatment?: boolean
  isFollowUp?: boolean
  isPhoneVisit?: boolean
  isOffSiteVisit?: boolean
  isPharmacokineticSubstudy?: boolean
  subjectAge?: number
  sexAtBirth?: RuntimeContext['sexAtBirth']
  wocbp?: boolean
  userRole?: UserRole
  responseSetStatus?: string
  isSubmitted?: boolean
  canEdit?: boolean
  correctionMode?: boolean
  addendumMode?: boolean
  locked?: boolean
}

function normalizeVisitType(raw?: string): VisitType {
  const v = String(raw ?? 'treatment').toLowerCase()
  if (v.includes('screen')) return 'screening'
  if (v.includes('phone')) return 'phone'
  if (v.includes('off') && v.includes('site')) return 'off_site'
  if (v.includes('unsched')) return 'unscheduled'
  if (v.includes('follow')) return 'follow_up'
  return 'treatment'
}

function resolveSignatureState(bridge: ProcedureCaptureBridge): SignatureState {
  if (bridge.locked) return 'locked'
  const status = String(bridge.responseSetStatus ?? '').toLowerCase()
  if (status === 'locked') return 'locked'
  if (bridge.isSubmitted || status === 'submitted') {
    return bridge.correctionMode || bridge.addendumMode ? 'signed' : 'signed'
  }
  if (bridge.canEdit === false && status !== 'draft' && status !== 'open') {
    return 'signed'
  }
  return 'unsigned'
}

export function mapProcedureExecutionToRuntimeContext(
  bridge: ProcedureCaptureBridge,
): RuntimeContext {
  const visitType = normalizeVisitType(
    typeof bridge.visitType === 'string' ? bridge.visitType : bridge.visitType,
  )

  return {
    studyId: bridge.studyId,
    studyVersionId: bridge.studyVersionId ?? '',
    siteId: bridge.siteId ?? bridge.organizationId ?? 'unknown-site',
    subjectId: bridge.studySubjectId,
    visitId: bridge.visitId,
    visitName: bridge.visitName ?? 'Visit',
    visitType,
    visitDate: bridge.visitDate ?? new Date().toISOString().slice(0, 10),
    scheduledDate: bridge.scheduledDate ?? bridge.visitDate ?? new Date().toISOString().slice(0, 10),
    country: bridge.country ?? 'US',
    timezone: bridge.timezone ?? 'UTC',
    arm: bridge.arm,
    cohort: bridge.cohort,
    phase: bridge.phase,
    isScreening: bridge.isScreening ?? visitType === 'screening',
    isTreatment: bridge.isTreatment ?? visitType === 'treatment',
    isFollowUp: bridge.isFollowUp ?? visitType === 'follow_up',
    isPhoneVisit: bridge.isPhoneVisit ?? visitType === 'phone',
    isOffSiteVisit: bridge.isOffSiteVisit ?? visitType === 'off_site',
    isPharmacokineticSubstudy: bridge.isPharmacokineticSubstudy ?? false,
    subjectAge: bridge.subjectAge,
    sexAtBirth: bridge.sexAtBirth,
    wocbp: bridge.wocbp,
    userRole: bridge.userRole ?? 'coordinator',
    signatureState: resolveSignatureState(bridge),
    locked: Boolean(bridge.locked || resolveSignatureState(bridge) === 'locked'),
    correctionMode: bridge.correctionMode,
    addendumMode: bridge.addendumMode,
  }
}

/** Build bridge from Phase 5 capture shell context row. */
export function bridgeFromProcedureCaptureContext(
  ctx: CaptureProcedureContext,
  options?: Partial<ProcedureCaptureBridge>,
): ProcedureCaptureBridge {
  return {
    procedureExecutionId: ctx.procedureExecutionId,
    studyId: ctx.studyId,
    studyVersionId: ctx.studyVersionId,
    studySubjectId: ctx.studySubjectId,
    visitId: ctx.visitId,
    visitName: ctx.visitLabel,
    organizationId: ctx.organizationId,
    siteId: ctx.organizationId,
    ...options,
  }
}

export function bridgeFromProcedureCaptureRow(
  row: ProcedureCaptureContextRow,
  options?: Partial<ProcedureCaptureBridge>,
): ProcedureCaptureBridge {
  return {
    procedureExecutionId: row.procedureExecutionId,
    studyId: row.studyId,
    studyVersionId: row.studyVersionId,
    studySubjectId: row.studySubjectId,
    visitId: row.visitId,
    visitName: row.visitLabel,
    organizationId: row.organizationId,
    siteId: row.organizationId,
    ...options,
  }
}
