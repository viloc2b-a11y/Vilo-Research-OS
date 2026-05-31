import { apiError } from '@/lib/api/source/errors'
import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import {
  canCollectOptionalSpecimen,
  canEnrollSubject,
  canExecuteProcedure,
  canExecuteVisit,
  canScreenSubject,
  canUseFutureSamples,
  hasActiveHIPAAAuthorization,
} from '@/lib/subject/consent/guards'

type Supabase = Parameters<typeof logOperationalEvent>[0]['supabase']

type ConsentEnforcementContext = {
  supabase: Supabase
  organizationId: string
  studyId: string
  subjectId: string
  actorUserId: string | null
  visitId?: string | null
  procedureExecutionId?: string | null
}

export type ConsentEnforcementResult =
  | { ok: true; message?: string }
  | {
      ok: false
      code: 'CONSENT_RUNTIME_BLOCKED'
      message: string
      requirement: string
      reason: string
    }

const CONSENT_BLOCK_EVENT = 'CONSENT_RUNTIME_BLOCKED'
const CONSENT_OPTIONAL_BLOCK_EVENT = 'CONSENT_RUNTIME_OPTIONAL_NOT_APPLICABLE'

function normalizeReason(reason?: string | null) {
  return reason?.trim() || 'Consent requirement was not met.'
}

function messageFor(requirement: string, reason?: string | null) {
  const normalized = normalizeReason(reason)
  const lower = normalized.toLowerCase()
  if (lower.includes('withdraw')) return 'Consent withdrawn; activity blocked.'
  if (lower.includes('hipaa')) return 'HIPAA authorization missing.'
  if (lower.includes('reconsent') || lower.includes('outdated')) {
    return 'Reconsent required before visit execution.'
  }
  if (requirement === 'screening' || requirement === 'enrollment') {
    return 'Consent required before screening.'
  }
  if (requirement === 'optional_specimen' || requirement === 'future_use_samples') {
    return 'Optional consent not granted; procedure not applicable.'
  }
  return normalized
}

async function logConsentBlock(
  context: ConsentEnforcementContext,
  input: {
    requirement: string
    reason: string
    eventType?: string
  },
) {
  await logOperationalEvent({
    supabase: context.supabase,
    organizationId: context.organizationId,
    studyId: context.studyId,
    visitId: context.visitId ?? null,
    procedureExecutionId: context.procedureExecutionId ?? null,
    actorUserId: context.actorUserId,
    eventType: input.eventType ?? CONSENT_BLOCK_EVENT,
    payload: {
      subject_id: context.subjectId,
      study_id: context.studyId,
      visit_id: context.visitId ?? null,
      procedure_execution_id: context.procedureExecutionId ?? null,
      consent_requirement: input.requirement,
      reason: input.reason,
      actor_user_id: context.actorUserId,
      blocked_at: new Date().toISOString(),
    },
  })
}

async function block(
  context: ConsentEnforcementContext,
  requirement: string,
  reason?: string | null,
  eventType?: string,
): Promise<ConsentEnforcementResult> {
  const normalized = normalizeReason(reason)
  await logConsentBlock(context, { requirement, reason: normalized, eventType })
  return {
    ok: false,
    code: 'CONSENT_RUNTIME_BLOCKED',
    message: messageFor(requirement, normalized),
    requirement,
    reason: normalized,
  }
}

export function consentBlockApiError(result: Exclude<ConsentEnforcementResult, { ok: true }>) {
  return apiError(
    result.code,
    result.message,
    {
      consent_requirement: result.requirement,
      reason: result.reason,
    },
    null,
    'api',
  )
}

export async function enforceConsentForScreening(
  context: ConsentEnforcementContext,
): Promise<ConsentEnforcementResult> {
  const guard = await canScreenSubject(context.supabase, {
    subjectId: context.subjectId,
    studyId: context.studyId,
  })
  return guard.ok ? { ok: true } : block(context, 'screening', guard.reason)
}

export async function enforceConsentForEnrollment(
  context: ConsentEnforcementContext,
): Promise<ConsentEnforcementResult> {
  const guard = await canEnrollSubject(context.supabase, {
    subjectId: context.subjectId,
    studyId: context.studyId,
  })
  return guard.ok ? { ok: true } : block(context, 'enrollment', guard.reason)
}

export async function enforceConsentForVisitExecution(
  context: ConsentEnforcementContext,
): Promise<ConsentEnforcementResult> {
  const guard = await canExecuteVisit(context.supabase, {
    subjectId: context.subjectId,
    studyId: context.studyId,
  })
  return guard.ok ? { ok: true } : block(context, 'visit_execution', guard.reason)
}

type ProcedureConsentHints = {
  code?: string | null
  label?: string | null
}

function procedureText(hints?: ProcedureConsentHints | null) {
  return `${hints?.code ?? ''} ${hints?.label ?? ''}`.toLowerCase()
}

function procedureRequiresHipaa(hints?: ProcedureConsentHints | null) {
  const text = procedureText(hints)
  return /\bhipaa\b|protected health|privacy authorization/.test(text)
}

function procedureRequiresOptionalSpecimen(hints?: ProcedureConsentHints | null) {
  const text = procedureText(hints)
  return /optional.*(specimen|sample)|biospecimen|sample storage|specimen storage/.test(text)
}

function procedureRequiresFutureUse(hints?: ProcedureConsentHints | null) {
  const text = procedureText(hints)
  return /future.*(use|research|sample)|research use|future studies/.test(text)
}

export async function enforceConsentForProcedureExecution(
  context: ConsentEnforcementContext,
  hints?: ProcedureConsentHints | null,
): Promise<ConsentEnforcementResult> {
  const resolvedHints = hints ?? await loadProcedureConsentHints(context)
  const hipaaRequired = procedureRequiresHipaa(resolvedHints)
  const guard = await canExecuteProcedure(context.supabase, {
    subjectId: context.subjectId,
    studyId: context.studyId,
    procedureRequiresHipaa: hipaaRequired,
  })
  if (!guard.ok) return block(context, hipaaRequired ? 'hipaa_authorization' : 'procedure_execution', guard.reason)

  if (hipaaRequired && !await hasActiveHIPAAAuthorization(context.supabase, context.subjectId)) {
    return block(context, 'hipaa_authorization', 'Active HIPAA authorization is required.')
  }

  if (procedureRequiresOptionalSpecimen(resolvedHints)) {
    const optional = await canCollectOptionalSpecimen(context.supabase, context.subjectId)
    if (!optional.ok) {
      return block(
        context,
        'optional_specimen',
        optional.reason ?? 'Optional specimen consent is not granted.',
        CONSENT_OPTIONAL_BLOCK_EVENT,
      )
    }
  }

  if (procedureRequiresFutureUse(resolvedHints)) {
    const futureUse = await canUseFutureSamples(context.supabase, context.subjectId)
    if (!futureUse.ok) {
      return block(
        context,
        'future_use_samples',
        futureUse.reason ?? 'Future use consent is not granted.',
        CONSENT_OPTIONAL_BLOCK_EVENT,
      )
    }
  }

  return { ok: true }
}

async function loadProcedureConsentHints(
  context: ConsentEnforcementContext,
): Promise<ProcedureConsentHints | null> {
  if (!context.procedureExecutionId) return null
  const { data } = await context.supabase
    .from('procedure_executions')
    .select('procedure_definitions(code, label)')
    .eq('id', context.procedureExecutionId)
    .maybeSingle()
  const raw = data?.procedure_definitions
  const def = Array.isArray(raw) ? raw[0] : raw
  if (!def || typeof def !== 'object') return null
  return {
    code: typeof def.code === 'string' ? def.code : null,
    label: typeof def.label === 'string' ? def.label : null,
  }
}
