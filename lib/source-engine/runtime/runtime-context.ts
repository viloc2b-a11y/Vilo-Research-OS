/**
 * Runtime execution context — study / site / subject / visit / user / signature state.
 * Separated from clinical definitions; passed into rules, validators, calculators.
 */

export type VisitType = 'screening' | 'treatment' | 'follow_up' | 'phone' | 'off_site' | 'unscheduled'

export type SignatureState = 'unsigned' | 'signed' | 'broken' | 'locked'

export type UserRole =
  | 'coordinator'
  | 'principal_investigator'
  | 'sub_investigator'
  | 'monitor'
  | 'viewer'
  | 'study_admin'

export type FieldResponseValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | { value: number; unit: string }

export type RepeatableRow = {
  instanceId: string
  fields: Record<string, FieldResponseValue>
  disabled?: boolean
}

/** Captured values for one source instance (visit/procedure). */
export type SourceResponses = {
  fields: Record<string, FieldResponseValue>
  repeatableSections?: Record<string, RepeatableRow[]>
  /** Tracks prior values for `changed` operator */
  previousFields?: Record<string, FieldResponseValue>
}

export type RuntimeContext = {
  studyId: string
  studyVersionId: string
  siteId: string
  subjectId: string
  visitId: string
  visitName: string
  visitType: VisitType
  visitDate: string
  scheduledDate: string
  country: string
  timezone: string
  arm?: string
  cohort?: string
  phase?: string
  isScreening: boolean
  isTreatment: boolean
  isFollowUp: boolean
  isPhoneVisit: boolean
  isOffSiteVisit: boolean
  isPharmacokineticSubstudy: boolean
  subjectAge?: number
  sexAtBirth?: 'female' | 'male' | 'other' | 'unknown'
  wocbp?: boolean
  userRole: UserRole
  signatureState: SignatureState
  locked: boolean
  correctionMode?: boolean
  addendumMode?: boolean
  /** Study template config snapshot */
  config?: Record<string, unknown>
}

export function createEmptyResponses(): SourceResponses {
  return { fields: {}, repeatableSections: {} }
}

/** Read flat field or repeatable row field (`sectionId.instanceId.fieldId`). */
export function readResponseValue(
  responses: SourceResponses,
  fieldRef: string,
): FieldResponseValue | undefined {
  if (!fieldRef.includes('.')) {
    return responses.fields[fieldRef]
  }
  const [sectionId, instanceId, ...rest] = fieldRef.split('.')
  if (!instanceId || rest.length === 0) return undefined
  const row = responses.repeatableSections?.[sectionId]?.find((r) => r.instanceId === instanceId)
  return row?.fields[rest.join('.')]
}

export function readContextValue(context: RuntimeContext, key: string): unknown {
  const map: Record<string, unknown> = {
    studyId: context.studyId,
    country: context.country,
    wocbp: context.wocbp,
    sexAtBirth: context.sexAtBirth,
    subjectAge: context.subjectAge,
    visitType: context.visitType,
    isPhoneVisit: context.isPhoneVisit,
    isOffSiteVisit: context.isOffSiteVisit,
    isPharmacokineticSubstudy: context.isPharmacokineticSubstudy,
    signatureState: context.signatureState,
    locked: context.locked,
    correctionMode: context.correctionMode,
    addendumMode: context.addendumMode,
    userRole: context.userRole,
  }
  if (key in map) return map[key]
  if (key.startsWith('config.')) {
    const path = key.slice('config.'.length)
    return (context.config as Record<string, unknown> | undefined)?.[path]
  }
  return undefined
}
