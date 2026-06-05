import type { SupabaseClient } from '@supabase/supabase-js'
import { canExecuteStudyRuntime } from '@/lib/studies/runtime-readiness'
import { computeVisitReadinessProjection } from '@/lib/projections/compute/visit-readiness'
import { explainVisitReadinessBlocked } from '@/lib/runtime-replay/explain/readiness-blocked'
import { validateConsentRecord } from '@/lib/subject/consent/validate-consent-record'
import { canExecuteProcedure, canExecuteVisit } from '@/lib/subject/consent/guards'
import { loadSubjectOperationalIntelligence } from '@/lib/subject/operations/loadSubjectOperationalIntelligence'
import { loadCoordinatorCommandCenter } from '@/lib/coordinator-command-center/load-coordinator-command-center'
import { validateProcedure } from '@/lib/visit-runtime/validateProcedure'
import type {
  CRAMonitoringWorkbookReadinessCheck,
  CRAMonitoringWorkbookReadinessResult,
  CRAMonitoringWorkbookReadinessStatus,
} from './types'

type SubjectRow = {
  id: string
  subject_identifier: string | null
}

type ConsentRow = Record<string, unknown>

type VisitRow = {
  id: string
  study_subject_id: string
  visit_name: string | null
  visit_status: string | null
}

type ProcedureRow = {
  id: string
  visit_id: string
}

const RESTRICTED_TERMS = [
  /revenue leakage/i,
  /\bVPI\b/i,
  /coordinator burden/i,
  /query analytics/i,
  /deviation prediction/i,
]

function safeText(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return fallback
  if (RESTRICTED_TERMS.some((pattern) => pattern.test(text))) return fallback
  return text
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text : null
}

function boolValue(value: unknown) {
  return value === true
}

function addUnique(list: string[], value: string) {
  if (!list.includes(value)) list.push(value)
}

function classifyConsentValidation(
  subjectIdentifier: string,
  validation: ReturnType<typeof validateConsentRecord>,
  blockers: string[],
  warnings: string[],
) {
  if (validation.blocking_issues.length > 0) {
    addUnique(blockers, `${subjectIdentifier}: consent is not ready for workbook generation.`)
  }

  for (const issue of validation.blocking_issues) {
    const text = safeText(issue, 'Consent is not ready.')
    addUnique(blockers, `${subjectIdentifier}: ${text}`)
  }

  for (const warning of validation.warnings) {
    const text = safeText(warning, 'Consent follow-up is recommended.')
    addUnique(warnings, `${subjectIdentifier}: ${text}`)
  }
}

export async function evaluateCRAMonitoringWorkbookReadiness(
  supabase: SupabaseClient,
  studyId: string,
): Promise<CRAMonitoringWorkbookReadinessResult> {
  const checkedAt = new Date().toISOString()
  const blockers: string[] = []
  const warnings: string[] = []
  const checks: CRAMonitoringWorkbookReadinessCheck[] = []

  const { data: study, error: studyError } = await supabase
    .from('studies')
    .select('id, name, protocol_number, organization_id')
    .eq('id', studyId)
    .maybeSingle()

  if (studyError || !study) {
    return {
      status: 'BLOCKED',
      badgeLabel: 'BLOCKED',
      checkedAt,
      studyId,
      studyName: 'Unknown study',
      protocolNumber: null,
      siteName: 'Unknown site',
      checks: [
        {
          id: 'study',
          label: 'Study context',
          status: 'blocker',
          detail: 'Study could not be loaded for readiness evaluation.',
        },
      ],
      blockers: ['Study context could not be loaded.'],
      warnings: [],
    }
  }

  const organizationId = String(study.organization_id)
  const studyName = safeText(study.name, 'Unknown study')
  const protocolNumber = typeof study.protocol_number === 'string' && study.protocol_number.trim()
    ? study.protocol_number.trim()
    : null
  const { data: organization } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle()

  const [
    studyRuntime,
    commandCenter,
    subjectsResult,
    consentRowsResult,
    consentEvidenceResult,
    visitsResult,
    proceduresResult,
  ] = await Promise.all([
    canExecuteStudyRuntime({ supabase, studyId, organizationId }),
    loadCoordinatorCommandCenter({ organizationId, selectedStudyId: studyId, limit: 8, supabaseClient: supabase }),
    supabase
      .from('study_subjects')
      .select('id, subject_identifier')
      .eq('study_id', studyId)
      .order('created_at', { ascending: true }),
    supabase
      .from('subject_consent_versions')
      .select('*, coordinator_signature:coordinator_signature_request_id(status), pi_signature:pi_signature_request_id(status), patient_signature:patient_signature_id(signed_at, signer_type, signature_method), lar_guardian_signature:lar_guardian_signature_id(signed_at, signer_type, signature_method), witness_signature:witness_signature_id(signed_at, signer_type, signature_method), study_subjects(subject_identifier), consent_document_versions(version_number, status, review_status, language)')
      .eq('study_id', studyId)
      .order('created_at', { ascending: false }),
    supabase
      .from('subject_consent_documents')
      .select('id, study_subject_id, consent_version_id')
      .eq('study_id', studyId),
    supabase
      .from('visits')
      .select('id, study_subject_id, visit_name, visit_status')
      .eq('study_id', studyId)
      .order('scheduled_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('procedure_executions')
      .select('id, visit_id, organization_id')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
  ])

  if (!studyRuntime.canExecute) {
    for (const blocker of studyRuntime.blockers) {
      addUnique(blockers, safeText(blocker, 'Study runtime is not ready.'))
    }
  }
  for (const warning of studyRuntime.warnings) {
    addUnique(warnings, safeText(warning, 'Study runtime needs review.'))
  }

  if (studyRuntime.packageConsistency === 'Fail') {
    addUnique(blockers, 'Published source package consistency failed.')
  } else if (studyRuntime.packageConsistency === 'Unavailable') {
    addUnique(warnings, 'Published source package consistency could not be verified.')
  }

  checks.push({
    id: 'study-runtime',
    label: 'Study runtime',
    status: studyRuntime.canExecute ? (studyRuntime.warnings.length > 0 ? 'warning' : 'pass') : 'blocker',
    detail: studyRuntime.canExecute
      ? 'Source package, visit definitions, and procedure bindings are aligned.'
      : 'Study runtime has blocking continuity issues.',
  })

  if (commandCenter.versionDriftAlerts.length > 0) {
    addUnique(warnings, 'Some source lineage changes need review before workbook generation.')
  }
  if (commandCenter.runtimeAlerts.some((alert) =>
    /signature|runtime package/i.test(`${alert.title} ${alert.detail}`) &&
    !/query/i.test(`${alert.title} ${alert.detail}`),
  )) {
    addUnique(warnings, 'Some source publication steps still need attention.')
  }

  const subjects = (subjectsResult.data ?? []) as SubjectRow[]
  const latestConsentBySubject = new Map<string, ConsentRow>()
  const evidenceCounts = new Map<string, number>()

  for (const row of (consentRowsResult.data ?? []) as ConsentRow[]) {
    const subjectId = String(row.study_subject_id ?? row.subjectId ?? '')
    if (!latestConsentBySubject.has(subjectId)) {
      latestConsentBySubject.set(subjectId, row)
    }
  }

  for (const row of (consentEvidenceResult.data ?? []) as ConsentRow[]) {
    const subjectId = String(row.study_subject_id ?? '')
    evidenceCounts.set(subjectId, (evidenceCounts.get(subjectId) ?? 0) + 1)
  }

  const subjectIntelligence = await Promise.all(
    subjects.map(async (subject) => {
      const subjectIdentifier = safeText(subject.subject_identifier, 'Unknown subject')
      const consentRow = latestConsentBySubject.get(subject.id)
      const consentDocumentVersion = Array.isArray(consentRow?.consent_document_versions)
        ? (consentRow?.consent_document_versions[0] as Record<string, unknown> | undefined)
        : (consentRow?.consent_document_versions as Record<string, unknown> | undefined)
      const validation = validateConsentRecord({
        libraryStatus: stringOrNull(consentDocumentVersion?.status),
        libraryReviewStatus: stringOrNull(consentDocumentVersion?.review_status),
        completionMethod: stringOrNull(consentRow?.completion_method),
        consentStatus: stringOrNull(consentRow?.status),
        consentDateTime: stringOrNull(consentRow?.completed_at ?? consentRow?.effective_at),
        subjectSignatureRequired: true,
        coordinatorSignatureRequired: true,
        piSignatureRequired: boolValue(consentRow?.requires_pi_review ?? consentRow?.requiresPiReview),
        witnessSignatureRequired: boolValue(consentRow?.witness_signature_id),
        larSignatureRequired: boolValue(consentRow?.lar_guardian_signature_id),
        subjectSignedAt: consentRow?.patient_signature && typeof consentRow.patient_signature === 'object'
          ? stringOrNull((consentRow.patient_signature as { signed_at?: unknown }).signed_at)
          : stringOrNull(consentRow?.subject_signed_at),
        coordinatorSignedAt: consentRow?.coordinator_signature && typeof consentRow.coordinator_signature === 'object'
          ? ((consentRow.coordinator_signature as { status?: unknown }).status === 'signed'
            ? stringOrNull(consentRow.completed_at ?? consentRow.active_at ?? consentRow.created_at)
            : null)
          : stringOrNull(consentRow?.coordinator_signed_at),
        piSignedAt: consentRow?.pi_signature && typeof consentRow.pi_signature === 'object'
          ? ((consentRow.pi_signature as { status?: unknown }).status === 'signed'
            ? stringOrNull(consentRow.completed_at ?? consentRow.active_at ?? consentRow.created_at)
            : null)
          : stringOrNull(consentRow?.pi_signed_at),
        witnessSignedAt: consentRow?.witness_signature && typeof consentRow.witness_signature === 'object'
          ? stringOrNull((consentRow.witness_signature as { signed_at?: unknown }).signed_at)
          : stringOrNull(consentRow?.witness_signed_at),
        larSignedAt: consentRow?.lar_guardian_signature && typeof consentRow.lar_guardian_signature === 'object'
          ? stringOrNull((consentRow.lar_guardian_signature as { signed_at?: unknown }).signed_at)
          : stringOrNull(consentRow?.lar_signed_at),
        participantCopyProvided: boolValue(consentRow?.participant_copy_provided),
        evidenceCount: evidenceCounts.get(subject.id) ?? 0,
        consentDocumentUploadPending: boolValue(consentRow?.consent_document_upload_pending),
        activeVersionUsed: stringOrNull(consentDocumentVersion?.status) === 'active',
        trainingValid: true,
        delegationValid: true,
        reconsentStatus: stringOrNull(consentRow?.reconsent_status),
        reconsentActionRequired: boolValue(consentRow?.reconsent_action_required),
      })

      classifyConsentValidation(subjectIdentifier, validation, blockers, warnings)

      const guardVisit = await canExecuteVisit(supabase, { subjectId: subject.id, studyId })
      if (!guardVisit.ok) {
        addUnique(blockers, `${subjectIdentifier}: ${safeText(guardVisit.reason, 'Consent gate is not ready.')}`)
      }

      const guardProcedure = await canExecuteProcedure(supabase, { subjectId: subject.id, studyId })
      if (!guardProcedure.ok) {
        addUnique(blockers, `${subjectIdentifier}: ${safeText(guardProcedure.reason, 'Procedure consent gate is not ready.')}`)
      }

      const intelligence = await loadSubjectOperationalIntelligence({
        subjectId: subject.id,
        studyId,
        organizationId,
      })
      if (intelligence.ok) {
        if (intelligence.data.pendingSignatures.length > 0) {
          addUnique(
            warnings,
            `${subjectIdentifier}: some signatures still need follow-up before workbook generation.`,
          )
        }
        if (intelligence.data.health === 'attention') {
          addUnique(warnings, `${subjectIdentifier}: operational follow-up is recommended.`)
        }
        if (intelligence.data.health === 'critical') {
          addUnique(blockers, `${subjectIdentifier}: operational readiness is not complete.`)
        }
      }

      return {
        subjectIdentifier,
        validation,
      }
    }),
  )

  void subjectIntelligence

  const visitRows = (visitsResult.data ?? []) as VisitRow[]
  const procedureRows = (proceduresResult.data ?? []) as ProcedureRow[]
  const proceduresByVisit = new Map<string, ProcedureRow[]>()
  for (const procedure of procedureRows) {
    const existing = proceduresByVisit.get(procedure.visit_id) ?? []
    existing.push(procedure)
    proceduresByVisit.set(procedure.visit_id, existing)
  }

  for (const visit of visitRows) {
    const projection = await computeVisitReadinessProjection(supabase, visit.id, organizationId)
    if (!projection) {
      addUnique(blockers, `${safeText(visit.visit_name, 'Visit')}: readiness data is unavailable.`)
      continue
    }

    const explanation = explainVisitReadinessBlocked({ projection })
    if (explanation.blocked) {
      for (const cause of explanation.primaryCauses) {
        const text = safeText(cause, 'Visit readiness is blocked.')
        if (/missing source|unsigned|blocking|reconsent|consent/i.test(text)) {
          addUnique(blockers, `${safeText(visit.visit_name, 'Visit')}: ${text}`)
        }
      }
    } else if (projection.readinessStatus === 'attention') {
      addUnique(warnings, `${safeText(visit.visit_name, 'Visit')}: visit readiness has non-blocking warnings.`)
    }

    if (projection.readinessStatus === 'blocked') {
      addUnique(blockers, `${safeText(visit.visit_name, 'Visit')}: visit is blocked until required items are resolved.`)
    }

    const visitProcedures = proceduresByVisit.get(visit.id) ?? []
    const procedureReadiness = await Promise.all(
      visitProcedures.map(async (procedure) => {
        const validation = await validateProcedure({
          supabase,
          procedureExecutionId: procedure.id,
          organizationId,
        })
        return { procedure, validation }
      }),
    )

    for (const item of procedureReadiness) {
      if (item.validation.status === 'blocked' || item.validation.status === 'incomplete') {
        const detail = item.validation.alerts
          .map((alert) => safeText(alert.message, 'Procedure readiness issue.'))
          .join('; ')
        addUnique(
          blockers,
          `${safeText(visit.visit_name, 'Visit')}: ${safeText(detail, 'A required procedure is not ready.')}`,
        )
      } else if (item.validation.status === 'warning') {
        addUnique(
          warnings,
          `${safeText(visit.visit_name, 'Visit')}: a procedure has a non-blocking readiness warning.`,
        )
      }
    }
  }

  checks.push({
    id: 'consent-readiness',
    label: 'Consent readiness',
    status: blockers.some((message) => /consent/i.test(message)) ? 'blocker' : warnings.some((message) => /consent/i.test(message)) ? 'warning' : 'pass',
    detail: blockers.some((message) => /consent/i.test(message))
      ? 'One or more consent records are not ready.'
      : warnings.some((message) => /consent/i.test(message))
        ? 'Some consent records need follow-up.'
        : 'Consent records are ready.',
  })

  checks.push({
    id: 'visit-readiness',
    label: 'Visit readiness',
    status: blockers.some((message) => /visit/i.test(message) && /blocked|missing source|unsigned/i.test(message))
      ? 'blocker'
      : warnings.some((message) => /visit/i.test(message))
        ? 'warning'
        : 'pass',
    detail: blockers.some((message) => /visit/i.test(message) && /blocked|missing source|unsigned/i.test(message))
      ? 'At least one visit has blocking readiness issues.'
      : warnings.some((message) => /visit/i.test(message))
        ? 'Some visits have non-blocking warnings.'
        : 'Visit readiness is clear.',
  })

  checks.push({
    id: 'signature-readiness',
    label: 'Signature readiness',
    status: blockers.some((message) => /signature/i.test(message))
      ? 'blocker'
      : warnings.some((message) => /signature/i.test(message))
        ? 'warning'
        : 'pass',
    detail: blockers.some((message) => /signature/i.test(message))
      ? 'A required signature is missing.'
      : warnings.some((message) => /signature/i.test(message))
        ? 'Some signatures are still pending follow-up.'
        : 'Signature readiness is clear.',
  })

  checks.push({
    id: 'operational-review',
    label: 'Operational review',
    status: warnings.length > 0 && blockers.length === 0 ? 'warning' : 'pass',
    detail: warnings.length > 0
      ? 'One or more non-blocking operational items need attention.'
      : 'No operational warnings were detected.',
  })

  const overallChecksStatus: CRAMonitoringWorkbookReadinessStatus =
    blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'PASS'

  return {
    status: overallChecksStatus,
    badgeLabel: overallChecksStatus === 'PASS' ? 'READY' : overallChecksStatus === 'WARNING' ? 'READY WITH WARNINGS' : 'BLOCKED',
    checkedAt,
    studyId,
    studyName,
    protocolNumber,
    siteName: safeText(organization?.name ?? commandCenter.studies.find((item) => item.id === studyId)?.name ?? studyName, 'Unknown site'),
    checks,
    blockers,
    warnings,
  }
}
