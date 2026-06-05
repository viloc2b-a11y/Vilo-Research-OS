import type { SupabaseClient } from '@supabase/supabase-js'
import { canExecuteStudyRuntime } from '@/lib/studies/runtime-readiness'
import { computeVisitReadinessProjection } from '@/lib/projections/compute/visit-readiness'
import { explainVisitReadinessBlocked } from '@/lib/runtime-replay/explain/readiness-blocked'
import { validateConsentRecord } from '@/lib/subject/consent/validate-consent-record'
import { canExecuteProcedure, canExecuteVisit } from '@/lib/subject/consent/guards'
import { getPendingSignatures } from '@/lib/subject/operations/getPendingSignatures'
import { getValidationIssues } from '@/lib/subject/operations/getValidationIssues'
import { loadSubjectOperationalIntelligence } from '@/lib/subject/operations/loadSubjectOperationalIntelligence'
import { loadSubjectWorkflowActions } from '@/lib/subject/workflow/data'
import { loadSubjectVisitsPage } from '@/lib/subject/visits/load-subject-visits'
import { loadCoordinatorCommandCenter } from '@/lib/coordinator-command-center/load-coordinator-command-center'
import { validateProcedure } from '@/lib/visit-runtime/validateProcedure'
import { validateVisitProcedures } from '@/lib/visit-runtime/validateVisitProcedures'

export type StudyDataReadinessMode = 'internal_review' | 'cra_workbook_precheck'

export type StudyDataReadinessSeverity = 'blocker' | 'warning' | 'info'

export type StudyDataReadinessCategory =
  | 'consent'
  | 'signature'
  | 'source'
  | 'visit'
  | 'version'
  | 'document_lineage'
  | 'scope'

export type StudyDataReadinessFinding = {
  id: string
  category: StudyDataReadinessCategory
  severity: StudyDataReadinessSeverity
  subjectIdentifier?: string | null
  visitName?: string | null
  issue: string
  nextAction: string
  targetRoute: string | null
  subjectId?: string | null
  visitId?: string | null
}

export type StudyDataReadinessNextAction = {
  label: string
  targetRoute: string
  subjectId?: string | null
  visitId?: string | null
}

export type StudyDataReadinessResult = {
  mode: StudyDataReadinessMode
  status: 'ready' | 'ready_with_warnings' | 'blocked'
  checkedAt: string
  studyId: string
  organizationId: string
  studyName: string
  protocolNumber: string | null
  siteName: string
  subjectsReviewed: number
  visitsReviewed: number
  blockersCount: number
  warningsCount: number
  infoCount: number
  findings: Record<StudyDataReadinessCategory, StudyDataReadinessFinding[]>
  nextActions: StudyDataReadinessNextAction[]
}

type SubjectRow = {
  id: string
  subject_identifier: string | null
}

type VisitRow = {
  id: string
  study_subject_id: string
  visit_name: string | null
}

type ConsentRow = Record<string, unknown>

const HIDDEN_TERMS = [
  /revenue leakage/i,
  /\bVPI\b/i,
  /coordinator burden/i,
  /query analytics/i,
  /deviation prediction/i,
]

function cleanText(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return fallback
  if (HIDDEN_TERMS.some((pattern) => pattern.test(text))) return fallback
  return text
}

function maybeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text : null
}

function truthy(value: unknown) {
  return value !== null && value !== undefined && value !== false && value !== ''
}

function newFindingsBucket(): Record<StudyDataReadinessCategory, StudyDataReadinessFinding[]> {
  return {
    consent: [],
    signature: [],
    source: [],
    visit: [],
    version: [],
    document_lineage: [],
    scope: [],
  }
}

function makeFinding(input: {
  category: StudyDataReadinessCategory
  severity: StudyDataReadinessSeverity
  issue: string
  nextAction: string
  subjectIdentifier?: string | null
  visitName?: string | null
  subjectId?: string | null
  visitId?: string | null
  studyId: string
}): StudyDataReadinessFinding {
  return {
    id: `${input.category}:${input.severity}:${input.subjectId ?? input.visitId ?? input.issue.slice(0, 24)}`,
    category: input.category,
    severity: input.severity,
    subjectIdentifier: input.subjectIdentifier ?? null,
    visitName: input.visitName ?? null,
    issue: cleanText(input.issue, 'Readiness item requires review.'),
    nextAction: cleanText(input.nextAction, 'Review the item in the relevant workspace.'),
    targetRoute: input.subjectId
      ? `/studies/${input.studyId}/subjects/${input.subjectId}`
      : input.visitId
        ? `/visits/${input.visitId}`
        : `/studies/${input.studyId}`,
    subjectId: input.subjectId ?? null,
    visitId: input.visitId ?? null,
  }
}

function addFinding(
  bucket: Record<StudyDataReadinessCategory, StudyDataReadinessFinding[]>,
  finding: StudyDataReadinessFinding,
) {
  bucket[finding.category].push(finding)
}

function flatFindings(bucket: Record<StudyDataReadinessCategory, StudyDataReadinessFinding[]>) {
  return Object.values(bucket).flat()
}

function routeForCategory(studyId: string, category: StudyDataReadinessCategory, subjectId?: string | null, visitId?: string | null) {
  if (subjectId) return `/studies/${studyId}/subjects/${subjectId}`
  if (visitId) return `/visits/${visitId}`
  switch (category) {
    case 'consent':
      return `/studies/${studyId}?tab=subjects`
    case 'signature':
      return `/studies/${studyId}?tab=visits`
    case 'source':
      return `/studies/${studyId}?tab=overview#source-bindings`
    case 'visit':
      return `/studies/${studyId}?tab=visits`
    case 'version':
      return `/studies/${studyId}?tab=overview#source-publish`
    case 'document_lineage':
      return `/studies/${studyId}?tab=documents`
    default:
      return `/studies/${studyId}`
  }
}

export async function evaluateStudyDataReadiness(params: {
  supabase: SupabaseClient
  studyId: string
  organizationId: string
  mode: StudyDataReadinessMode
  asOfDate?: string
  subjectScope?: { subjectId?: string | null }
  visitScope?: { visitId?: string | null }
}): Promise<StudyDataReadinessResult> {
  const checkedAt = params.asOfDate ?? new Date().toISOString()
  const findings = newFindingsBucket()

  const { data: study, error: studyError } = await params.supabase
    .from('studies')
    .select('id, name, protocol_number, organization_id')
    .eq('id', params.studyId)
    .eq('organization_id', params.organizationId)
    .maybeSingle()

  if (studyError || !study) {
    return {
      mode: params.mode,
      status: 'blocked',
      checkedAt,
      studyId: params.studyId,
      organizationId: params.organizationId,
      studyName: 'Unknown study',
      protocolNumber: null,
      siteName: 'Unknown site',
      subjectsReviewed: 0,
      visitsReviewed: 0,
      blockersCount: 1,
      warningsCount: 0,
      infoCount: 0,
      findings: {
        consent: [
          makeFinding({
            category: 'consent',
            severity: 'blocker',
            studyId: params.studyId,
            issue: 'Study could not be loaded.',
            nextAction: 'Open the study workspace and refresh the page.',
          }),
        ],
        signature: [],
        source: [],
        visit: [],
        version: [],
        document_lineage: [],
        scope: [],
      },
      nextActions: [
        {
          label: 'Open study workspace',
          targetRoute: `/studies/${params.studyId}`,
        },
      ],
    }
  }

  const studyName = cleanText(study.name, 'Unknown study')
  const protocolNumber = maybeString(study.protocol_number)
  const { data: organization } = await params.supabase
    .from('organizations')
    .select('name')
    .eq('id', params.organizationId)
    .maybeSingle()

  const [studyRuntime, commandCenter] = await Promise.all([
    canExecuteStudyRuntime({
      supabase: params.supabase,
      studyId: params.studyId,
      organizationId: params.organizationId,
    }),
    loadCoordinatorCommandCenter({
      organizationId: params.organizationId,
      selectedStudyId: params.studyId,
      limit: 8,
      supabaseClient: params.supabase,
    }),
  ])

  if (!studyRuntime.canExecute) {
    for (const blocker of studyRuntime.blockers) {
      addFinding(
        findings,
        makeFinding({
          category: 'source',
          severity: 'blocker',
          studyId: params.studyId,
          issue: blocker,
          nextAction: 'Review the study source continuity items in the Overview tab.',
        }),
      )
    }
  }
  for (const warning of studyRuntime.warnings) {
    addFinding(
      findings,
      makeFinding({
        category: 'version',
        severity: 'warning',
        studyId: params.studyId,
        issue: warning,
        nextAction: 'Review the source package and version continuity in the Overview tab.',
      }),
    )
  }

  if (studyRuntime.packageConsistency === 'Fail') {
    addFinding(
      findings,
      makeFinding({
        category: 'version',
        severity: 'blocker',
        studyId: params.studyId,
        issue: 'Published source package consistency failed.',
        nextAction: 'Review the published source package before external review.',
      }),
    )
  }
  if (studyRuntime.packageConsistency === 'Unavailable') {
    addFinding(
      findings,
      makeFinding({
        category: 'version',
        severity: 'warning',
        studyId: params.studyId,
        issue: 'Published source package consistency could not be verified.',
        nextAction: 'Review source publish status before external review.',
      }),
    )
  }

  if (commandCenter.versionDriftAlerts.length > 0) {
    addFinding(
      findings,
      makeFinding({
        category: 'document_lineage',
        severity: 'warning',
        studyId: params.studyId,
        issue: 'Source lineage changes need review.',
        nextAction: 'Open the source builder and confirm the latest lineage.',
      }),
    )
  }

  const subjectRows = (await params.supabase
    .from('study_subjects')
    .select('id, subject_identifier')
    .eq('study_id', params.studyId)
    .eq('organization_id', params.organizationId)
    .order('subject_identifier', { ascending: true })).data ?? []

  const filteredSubjects = params.subjectScope?.subjectId
    ? subjectRows.filter((row) => String(row.id) === params.subjectScope?.subjectId)
    : subjectRows

  const visitRows = (await params.supabase
    .from('visits')
    .select('id, study_subject_id, visit_name')
    .eq('study_id', params.studyId)
    .eq('organization_id', params.organizationId)
    .order('scheduled_date', { ascending: true, nullsFirst: false })).data ?? []

  const filteredVisits = params.visitScope?.visitId
    ? visitRows.filter((row) => String(row.id) === params.visitScope?.visitId)
    : visitRows.filter((row) =>
        filteredSubjects.length === 0 ? true : filteredSubjects.some((subject) => String(subject.id) === String(row.study_subject_id)))

  const consentRows = (await params.supabase
    .from('subject_consent_versions')
    .select('*, coordinator_signature:coordinator_signature_request_id(status), pi_signature:pi_signature_request_id(status), patient_signature:patient_signature_id(signed_at), lar_guardian_signature:lar_guardian_signature_id(signed_at), witness_signature:witness_signature_id(signed_at), study_subjects(subject_identifier), consent_document_versions(version_number, status, review_status, language)')
    .eq('study_id', params.studyId)
    .order('created_at', { ascending: false })).data ?? []

  const evidenceRows = (await params.supabase
    .from('subject_consent_documents')
    .select('id, study_subject_id, consent_version_id')
    .eq('study_id', params.studyId)).data ?? []

  const latestConsentBySubject = new Map<string, ConsentRow>()
  for (const row of consentRows as ConsentRow[]) {
    const subjectId = String(row.study_subject_id ?? '')
    if (!latestConsentBySubject.has(subjectId)) latestConsentBySubject.set(subjectId, row)
  }

  const evidenceCountBySubject = new Map<string, number>()
  for (const row of evidenceRows as ConsentRow[]) {
    const subjectId = String(row.study_subject_id ?? '')
    evidenceCountBySubject.set(subjectId, (evidenceCountBySubject.get(subjectId) ?? 0) + 1)
  }

  for (const subject of filteredSubjects as SubjectRow[]) {
    const subjectIdentifier = cleanText(subject.subject_identifier, 'Unknown subject')
    const consentRow = latestConsentBySubject.get(String(subject.id))
    const consentDocument = Array.isArray(consentRow?.consent_document_versions)
      ? (consentRow.consent_document_versions[0] as Record<string, unknown> | undefined)
      : (consentRow?.consent_document_versions as Record<string, unknown> | undefined)

    const validation = validateConsentRecord({
      libraryStatus: maybeString(consentDocument?.status),
      libraryReviewStatus: maybeString(consentDocument?.review_status),
      completionMethod: maybeString(consentRow?.completion_method),
      consentStatus: maybeString(consentRow?.status),
      consentDateTime: maybeString(consentRow?.completed_at ?? consentRow?.effective_at),
      subjectSignatureRequired: true,
      coordinatorSignatureRequired: true,
      piSignatureRequired: truthy(consentRow?.requires_pi_review ?? consentRow?.requiresPiReview),
      witnessSignatureRequired: truthy(consentRow?.witness_signature_id),
      larSignatureRequired: truthy(consentRow?.lar_guardian_signature_id),
      subjectSignedAt: maybeString((consentRow?.patient_signature as Record<string, unknown> | undefined)?.signed_at),
      coordinatorSignedAt: maybeString(consentRow?.coordinator_signed_at),
      piSignedAt: maybeString(consentRow?.pi_signed_at),
      witnessSignedAt: maybeString((consentRow?.witness_signature as Record<string, unknown> | undefined)?.signed_at),
      larSignedAt: maybeString((consentRow?.lar_guardian_signature as Record<string, unknown> | undefined)?.signed_at),
      participantCopyProvided: truthy(consentRow?.participant_copy_provided),
      evidenceCount: evidenceCountBySubject.get(String(subject.id)) ?? 0,
      consentDocumentUploadPending: truthy(consentRow?.consent_document_upload_pending),
      activeVersionUsed: maybeString(consentDocument?.status) === 'active',
      trainingValid: true,
      delegationValid: true,
      reconsentStatus: maybeString(consentRow?.reconsent_status),
      reconsentActionRequired: truthy(consentRow?.reconsent_action_required),
    })

    for (const issue of validation.blocking_issues) {
      addFinding(
        findings,
        makeFinding({
          category: 'consent',
          severity: 'blocker',
          studyId: params.studyId,
          subjectId: String(subject.id),
          subjectIdentifier,
          issue,
          nextAction: 'Open the subject consent panel and resolve the blocking consent item.',
        }),
      )
    }
    for (const warning of validation.warnings) {
      addFinding(
        findings,
        makeFinding({
          category: 'consent',
          severity: 'warning',
          studyId: params.studyId,
          subjectId: String(subject.id),
          subjectIdentifier,
          issue: warning,
          nextAction: 'Review the subject consent panel and confirm the follow-up item.',
        }),
      )
    }

    if (validation.blocking_issues.length === 0 && validation.warnings.length === 0) {
      addFinding(
        findings,
        makeFinding({
          category: 'consent',
          severity: 'info',
          studyId: params.studyId,
          subjectId: String(subject.id),
          subjectIdentifier,
          issue: 'Consent record is ready.',
          nextAction: 'No action required.',
        }),
      )
    }

    const visitGuard = await canExecuteVisit(params.supabase, { subjectId: String(subject.id), studyId: params.studyId })
    if (!visitGuard.ok && visitGuard.reason) {
      addFinding(
        findings,
        makeFinding({
          category: 'visit',
          severity: 'blocker',
          studyId: params.studyId,
          subjectId: String(subject.id),
          subjectIdentifier,
          issue: visitGuard.reason,
          nextAction: 'Resolve the consent gate in the subject workspace.',
        }),
      )
    }

    const procedureGuard = await canExecuteProcedure(params.supabase, { subjectId: String(subject.id), studyId: params.studyId })
    if (!procedureGuard.ok && procedureGuard.reason) {
      addFinding(
        findings,
        makeFinding({
          category: 'signature',
          severity: 'blocker',
          studyId: params.studyId,
          subjectId: String(subject.id),
          subjectIdentifier,
          issue: procedureGuard.reason,
          nextAction: 'Resolve the consent or HIPAA gate before external review.',
        }),
      )
    }

    const intelligence = await loadSubjectOperationalIntelligence({
      subjectId: String(subject.id),
      studyId: params.studyId,
      organizationId: params.organizationId,
    })
    if (intelligence.ok) {
      const limitedIssues = getValidationIssues(intelligence.data.validationIssues, 6)
      for (const issue of limitedIssues) {
        addFinding(
          findings,
          makeFinding({
            category: issue.kind === 'finding' ? 'source' : 'visit',
            severity: issue.kind === 'blocked' ? 'blocker' : 'warning',
            studyId: params.studyId,
            subjectId: String(subject.id),
            subjectIdentifier,
            issue: issue.label,
            nextAction: 'Open the subject operational command center and review the issue.',
          }),
        )
      }

      const [subjectVisitsPage, workflowActionsResult] = await Promise.all([
        loadSubjectVisitsPage(String(subject.id), params.studyId),
        loadSubjectWorkflowActions(String(subject.id), params.organizationId),
      ])

      if (workflowActionsResult.ok) {
        const pendingSignatureItems = getPendingSignatures({
          visits: subjectVisitsPage?.visits ?? [],
          workflowActions: workflowActionsResult.actions,
        })
        if (pendingSignatureItems.length > 0) {
          addFinding(
            findings,
            makeFinding({
              category: 'signature',
              severity: 'warning',
              studyId: params.studyId,
              subjectId: String(subject.id),
              subjectIdentifier,
              issue: 'There are pending signatures to review.',
              nextAction: 'Open the subject operational command center.',
            }),
          )
        }
      }

      if (intelligence.data.health === 'critical') {
        addFinding(
          findings,
          makeFinding({
            category: 'visit',
            severity: 'blocker',
            studyId: params.studyId,
            subjectId: String(subject.id),
            subjectIdentifier,
            issue: 'Subject operational readiness is not complete.',
            nextAction: 'Open the subject workspace and resolve the highlighted issues.',
          }),
        )
      } else if (intelligence.data.health === 'attention') {
        addFinding(
          findings,
          makeFinding({
            category: 'visit',
            severity: 'warning',
            studyId: params.studyId,
            subjectId: String(subject.id),
            subjectIdentifier,
            issue: 'Subject operational follow-up is recommended.',
            nextAction: 'Open the subject workspace for a quick review.',
          }),
        )
      }
    }
  }

  const visitProceduresByVisit = new Map<string, VisitRow[]>()
  for (const visit of filteredVisits as VisitRow[]) {
    const list = visitProceduresByVisit.get(String(visit.id)) ?? []
    list.push(visit)
    visitProceduresByVisit.set(String(visit.id), list)
  }

  for (const visit of filteredVisits as VisitRow[]) {
    const subject = filteredSubjects.find((row) => String(row.id) === String(visit.study_subject_id))
    const subjectIdentifier = cleanText(subject?.subject_identifier, 'Unknown subject')
    const projection = await computeVisitReadinessProjection(params.supabase, String(visit.id), params.organizationId)
    if (!projection) {
      addFinding(
        findings,
        makeFinding({
          category: 'visit',
          severity: 'warning',
          studyId: params.studyId,
          visitId: String(visit.id),
          visitName: visit.visit_name ?? undefined,
          subjectId: String(visit.study_subject_id),
          subjectIdentifier,
          issue: 'Visit readiness data is unavailable.',
          nextAction: 'Open the visit workspace and refresh the page.',
        }),
      )
      continue
    }

    const explanation = explainVisitReadinessBlocked({ projection })
    if (explanation.blocked) {
      addFinding(
        findings,
        makeFinding({
          category: 'visit',
          severity: 'blocker',
          studyId: params.studyId,
          visitId: String(visit.id),
          visitName: visit.visit_name ?? undefined,
          subjectId: String(visit.study_subject_id),
          subjectIdentifier,
          issue: explanation.primaryCauses[0] ?? 'Visit readiness is blocked.',
          nextAction: 'Open the visit workspace and resolve the blocking item.',
        }),
      )
    } else if (projection.readinessStatus === 'attention') {
      addFinding(
        findings,
        makeFinding({
          category: 'visit',
          severity: 'warning',
          studyId: params.studyId,
          visitId: String(visit.id),
          visitName: visit.visit_name ?? undefined,
          subjectId: String(visit.study_subject_id),
          subjectIdentifier,
          issue: 'Visit readiness has non-blocking warnings.',
          nextAction: 'Review the visit workspace before external review.',
        }),
      )
    }

    if (projection.missingSourceCount > 0) {
      addFinding(
        findings,
        makeFinding({
          category: 'source',
          severity: 'blocker',
          studyId: params.studyId,
          visitId: String(visit.id),
          visitName: visit.visit_name ?? undefined,
          subjectId: String(visit.study_subject_id),
          subjectIdentifier,
          issue: 'A required source item is incomplete.',
          nextAction: 'Open source capture and complete the missing required source.',
        }),
      )
    }

    if (params.mode === 'internal_review') {
      const visitValidation = await validateVisitProcedures({
        supabase: params.supabase,
        visitId: String(visit.id),
        organizationId: params.organizationId,
      })

      if (!visitValidation.ok) {
        addFinding(
          findings,
          makeFinding({
            category: 'source',
            severity: 'blocker',
            studyId: params.studyId,
            visitId: String(visit.id),
            visitName: visit.visit_name ?? undefined,
            subjectId: String(visit.study_subject_id),
            subjectIdentifier,
            issue: cleanText(visitValidation.error, 'Visit procedure validation is blocked.'),
            nextAction: 'Open source capture and resolve the procedure validation issue.',
          }),
        )
      }
    }

    const procedureRows = (await params.supabase
      .from('procedure_executions')
      .select('id, validation_status')
      .eq('visit_id', String(visit.id))
      .eq('organization_id', params.organizationId)).data ?? []

    for (const procedure of procedureRows as Array<{ id: string; validation_status: string | null }>) {
      const validation = await validateProcedure({
        supabase: params.supabase,
        procedureExecutionId: procedure.id,
        organizationId: params.organizationId,
      })
      if (validation.status === 'blocked' || validation.status === 'incomplete') {
        addFinding(
          findings,
          makeFinding({
            category: 'source',
            severity: 'blocker',
            studyId: params.studyId,
            visitId: String(visit.id),
            visitName: visit.visit_name ?? undefined,
            subjectId: String(visit.study_subject_id),
            subjectIdentifier,
            issue: validation.alerts.map((alert) => cleanText(alert.message, 'Procedure is not ready.')).join('; ') || 'Procedure is not ready.',
            nextAction: 'Open source capture and resolve the procedure validation issue.',
          }),
        )
      } else if (validation.status === 'warning') {
        addFinding(
          findings,
          makeFinding({
            category: 'source',
            severity: 'warning',
            studyId: params.studyId,
            visitId: String(visit.id),
            visitName: visit.visit_name ?? undefined,
            subjectId: String(visit.study_subject_id),
            subjectIdentifier,
            issue: 'Procedure validation has a non-blocking warning.',
            nextAction: 'Review the procedure source capture before external review.',
          }),
        )
      }
    }
  }

  const flat = flatFindings(findings)
  const blockersCount = flat.filter((item) => item.severity === 'blocker').length
  const warningsCount = flat.filter((item) => item.severity === 'warning').length
  const infoCount = flat.filter((item) => item.severity === 'info').length
  const status = blockersCount > 0 ? 'blocked' : warningsCount > 0 ? 'ready_with_warnings' : 'ready'

  const nextActions: StudyDataReadinessNextAction[] = []
  for (const finding of flat) {
    if (finding.severity === 'info') continue
    if (nextActions.some((item) => item.label === finding.nextAction)) continue
    nextActions.push({
      label: finding.nextAction,
      targetRoute: routeForCategory(params.studyId, finding.category, finding.subjectId, finding.visitId),
      subjectId: finding.subjectId ?? null,
      visitId: finding.visitId ?? null,
    })
    if (nextActions.length >= 6) break
  }

  return {
    mode: params.mode,
    status,
    checkedAt,
    studyId: params.studyId,
    organizationId: params.organizationId,
    studyName,
    protocolNumber,
    siteName: cleanText(organization?.name, 'Unknown site'),
    subjectsReviewed: filteredSubjects.length,
    visitsReviewed: filteredVisits.length,
    blockersCount,
    warningsCount,
    infoCount,
    findings,
    nextActions,
  }
}
