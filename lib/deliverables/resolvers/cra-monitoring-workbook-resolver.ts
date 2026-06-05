import { SupabaseClient } from '@supabase/supabase-js'
import {
  DeliverableRun,
  CRAMonitoringWorkbookEvidence,
  CRAMonitoringSubjectIndexItem,
  CRAMonitoringVisitIndexItem,
  CRAMonitoringProcedureMatrixItem,
  CRAMonitoringConsentSummaryItem,
  CRAMonitoringSignatureSummaryItem,
  CRAMonitoringDocumentLineageItem,
} from '../types'

type SourcePackageRow = {
  id: string
  package_version: number
  package_status: string
  generated_at: string | null
  generated_by: string | null
}

type VisitRuntimeRow = {
  id: string
  subject_id: string
  visit_name: string | null
  started_at: string | null
  visit_status: string
  source_package_id: string | null
}

type SubjectRow = {
  id: string
  subject_identifier: string | null
  enrollment_status: string
  created_at: string
  consented_at: string | null
  screening_date: string | null
  randomization_date_time: string | null
  randomization_arm: string | null
}

type ProcedureRuntimeRow = {
  id: string
  visit_instance_id: string
  procedure_name: string
  procedure_status: string
  completed_at: string | null
  performed_by: string | null
}

type ConsentVersionRow = {
  id: string
  study_subject_id: string
  consent_type: string
  consent_version_label: string
  status: string
  effective_at: string | null
  completed_at: string | null
  active_at: string | null
  created_at: string
  created_by: string | null
  consent_document_versions?: {
    version_number: number | null
    effective_date: string | null
    status: string | null
  } | null
}

type SubjectDocumentRow = {
  document_id: string
  study_subject_id: string
  visit_id: string | null
  compliance_document_id: string | null
  document_category: string
  file_name: string
  status: string
  uploaded_by: string | null
  created_at: string
  compliance_runtime_documents?: {
    operational_display_name: string | null
    document_classification: string | null
    created_at: string | null
    supersedes_document_id: string | null
    status: string | null
  } | null
}

type SubjectVisitDocumentRow = {
  id: string
  study_subject_id: string
  subject_visit_id: string
  document_type: string
  file_name: string
  uploaded_by: string | null
  uploaded_at: string
}

type OperationalSignatureRow = {
  artifact_id: string
  artifact_type: string
  subject_id: string
  signer_role_snapshot: string | null
  signature_meaning: string | null
  signed_at: string | null
  signed_artifact_hash: string | null
  status: string
}

function asText(value: unknown, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function asDate(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function countEarlierRows<T extends Record<string, unknown>>(rows: T[], current: T, dateKey: string, groupKey: (row: T) => string) {
  const currentGroup = groupKey(current)
  const currentTime = new Date(String(current[dateKey] ?? '')).getTime()
  if (!Number.isFinite(currentTime)) return 0

  return rows.filter((row) => {
    if (groupKey(row) !== currentGroup) return false
    const rowTime = new Date(String(row[dateKey] ?? '')).getTime()
    return Number.isFinite(rowTime) && rowTime < currentTime
  }).length
}

export async function resolveForCRAMonitoringWorkbook(
  supabase: SupabaseClient,
  run: DeliverableRun,
  asOfDate: string,
): Promise<CRAMonitoringWorkbookEvidence> {
  const scopeFilters = run.filters as {
    studyId?: string
    subjectId?: string
    visitInstanceId?: string
  } & Record<string, unknown>
  const studyId = scopeFilters?.studyId

  if (!studyId) {
    throw new Error('study_id is required for CRA Monitoring Workbook')
  }

  const { data: study, error: studyError } = await supabase
    .from('studies')
    .select('name, slug, organization_id')
    .eq('id', studyId)
    .single()

  if (studyError || !study) {
    throw new Error(`Failed to resolve study: ${studyError?.message}`)
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', study.organization_id)
    .single()

  const { data: sourcePackagesData } = await supabase
    .from('runtime_source_packages')
    .select('id, package_version, package_status, generated_at, generated_by')
    .eq('study_id', studyId)
    .order('package_version', { ascending: true })

  const sourcePackages = (sourcePackagesData || []) as SourcePackageRow[]
  const sourcePackageById = new Map<string, SourcePackageRow>()
  for (const sourcePackage of sourcePackages) {
    sourcePackageById.set(sourcePackage.id, sourcePackage)
  }

  let subjectsQuery = supabase
    .from('study_subjects')
    .select('id, subject_identifier, enrollment_status, created_at, consented_at, screening_date, randomization_date_time, randomization_arm')
    .eq('study_id', studyId)

  if (scopeFilters.subjectId) {
    subjectsQuery = subjectsQuery.eq('id', scopeFilters.subjectId)
  }

  const { data: subjectsData, error: subjectsError } = await subjectsQuery
  if (subjectsError) {
    throw new Error(`Failed to load subjects: ${subjectsError.message}`)
  }

  const subjectRows = (subjectsData || []) as SubjectRow[]
  const subjectIds = subjectRows.map((s) => s.id)
  const emptyUuid = '00000000-0000-0000-0000-000000000000'

  let visitsQuery = supabase
    .from('visit_runtime_instances')
    .select('id, subject_id, visit_name, started_at, visit_status, source_package_id')
    .in('subject_id', subjectIds.length > 0 ? subjectIds : [emptyUuid])
    .eq('visit_status', 'completed')

  if (scopeFilters.visitInstanceId) {
    visitsQuery = visitsQuery.eq('id', scopeFilters.visitInstanceId)
  }

  const { data: visitsData } = await visitsQuery
  const visitsRows = (visitsData || []) as VisitRuntimeRow[]
  const visitIds = visitsRows.map((v) => v.id)

  let proceduresData: ProcedureRuntimeRow[] = []
  if (visitIds.length > 0) {
    const { data: pData } = await supabase
      .from('procedure_runtime_instances')
      .select('id, visit_instance_id, procedure_name, procedure_status, completed_at, performed_by')
      .in('visit_instance_id', visitIds)
    proceduresData = (pData || []) as ProcedureRuntimeRow[]
  }

  const { data: consentVersionsData } = await supabase
    .from('subject_consent_versions')
    .select('id, study_subject_id, consent_type, consent_version_label, status, effective_at, completed_at, active_at, created_at, created_by, consent_document_versions(version_number, effective_date, status)')
    .in('study_subject_id', subjectIds.length > 0 ? subjectIds : [emptyUuid])
    .order('created_at', { ascending: false })

  const consentVersions = (consentVersionsData as unknown as ConsentVersionRow[]) || []
  const latestConsentBySubject = consentVersions.reduce((acc: Record<string, ConsentVersionRow>, row) => {
    if (!acc[row.study_subject_id]) acc[row.study_subject_id] = row
    return acc
  }, {})
  const consentVersionsBySubject = consentVersions.reduce((acc: Record<string, ConsentVersionRow[]>, row) => {
    const list = acc[row.study_subject_id] ?? []
    list.push(row)
    acc[row.study_subject_id] = list
    return acc
  }, {})

  const { data: subjectDocumentsData } = await supabase
    .from('subject_documents')
    .select('document_id, study_subject_id, visit_id, compliance_document_id, document_category, file_name, status, uploaded_by, created_at, compliance_runtime_documents(id, operational_display_name, document_classification, status, created_at, supersedes_document_id)')
    .in('study_subject_id', subjectIds.length > 0 ? subjectIds : [emptyUuid])
    .order('created_at', { ascending: false })

  const subjectDocuments = (subjectDocumentsData as unknown as SubjectDocumentRow[]) || []

  const { data: subjectVisitDocumentsData } = await supabase
    .from('subject_visit_documents')
    .select('id, study_subject_id, subject_visit_id, document_type, file_name, uploaded_by, uploaded_at')
    .in('study_subject_id', subjectIds.length > 0 ? subjectIds : [emptyUuid])
    .order('uploaded_at', { ascending: false })

  const subjectVisitDocuments = (subjectVisitDocumentsData as unknown as SubjectVisitDocumentRow[]) || []

  const { data: opSigsData } = await supabase
    .from('operational_signatures')
    .select('artifact_id, artifact_type, subject_id, signer_role_snapshot, signature_meaning, signed_at, signed_artifact_hash, status')
    .in('subject_id', subjectIds.length > 0 ? subjectIds : [emptyUuid])

  const opSigs = opSigsData || []

  const subjectById = new Map<string, SubjectRow>()
  for (const subject of subjectRows) {
    subjectById.set(String(subject.id), subject)
  }

  const visitById = new Map<string, VisitRuntimeRow>()
  for (const visit of visitsRows) {
    visitById.set(visit.id, visit)
  }

  const subjects: CRAMonitoringSubjectIndexItem[] = subjectRows.map((s) => {
    const consent = latestConsentBySubject[s.id]
    const visits = visitsRows.filter((v) => v.subject_id === s.id)
    const latestVisit = visits.sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())[0]

    return {
      subjectIdentifier: s.subject_identifier || 'Unknown',
      subjectStatus: s.enrollment_status,
      enrollmentDate: s.consented_at || s.created_at,
      screeningStatus: s.screening_date ? 'Screened' : '-',
      randomizationStatus: s.randomization_arm ? 'Randomized' : '-',
      currentConsentStatus: consent?.status || 'Unknown',
      currentConsentVersion: consent?.consent_version_label || '-',
      latestVisitStatus: latestVisit ? `${latestVisit.visit_name} (${latestVisit.visit_status})` : 'No Visits',
      notes: '-',
    }
  })

  const visits: CRAMonitoringVisitIndexItem[] = visitsRows.map((v) => {
    const sub = subjectById.get(v.subject_id)
    const procs = proceduresData.filter((p) => p.visit_instance_id === v.id)
    const completedProcs = procs.filter((p) => p.procedure_status === 'completed').length
    const sourcePackage = v.source_package_id ? sourcePackageById.get(v.source_package_id) : undefined
    const sourcePackageVersion = sourcePackage ? String(sourcePackage.package_version) : '-'

    return {
      subjectIdentifier: sub?.subject_identifier || 'Unknown',
      visitName: v.visit_name || '-',
      visitDate: v.started_at || '-',
      visitStatus: v.visit_status,
      sourceVersionUsed: sourcePackageVersion,
      sourcePackageId: v.source_package_id ?? undefined,
      proceduresCompletedCount: completedProcs,
      proceduresExpectedCount: procs.length,
      signatureStatus: 'Unknown',
      sourcePacketAvailable: false,
    }
  })

  const procedures: CRAMonitoringProcedureMatrixItem[] = proceduresData.map((p) => {
    const v = visitsRows.find((visit) => visit.id === p.visit_instance_id)
    const sub = v ? subjectById.get(v.subject_id) : undefined
    const sourcePackageVersion = v?.source_package_id ? String(sourcePackageById.get(v.source_package_id)?.package_version ?? '-') : '-'

    return {
      subjectIdentifier: sub?.subject_identifier || 'Unknown',
      visitName: v?.visit_name || 'Unknown',
      visitDate: v?.started_at || '-',
      procedureName: p.procedure_name,
      procedureStatus: p.procedure_status,
      performedDate: p.completed_at || '-',
      performedBy: p.performed_by || '-',
      sourceVersionUsed: sourcePackageVersion,
      signatureStatus: opSigs.some((sig: OperationalSignatureRow) => sig.artifact_id === p.id && sig.status === 'signed') ? 'Signed' : 'Pending',
    }
  })

  const consents: CRAMonitoringConsentSummaryItem[] = subjectRows.map((s) => {
    const consent = latestConsentBySubject[s.id]
    return {
      subjectIdentifier: s.subject_identifier || 'Unknown',
      currentConsentStatus: consent?.status || 'Unknown',
      consentVersion: consent?.consent_version_label || '-',
      reconsentRequired: false,
      withdrawn: consent?.status === 'withdrawn',
    }
  })

  const signatures: CRAMonitoringSignatureSummaryItem[] = (opSigs as OperationalSignatureRow[]).map((sig) => {
    const sub = subjectRows.find((s) => s.id === sig.subject_id)
    const p = proceduresData.find((procedure) => procedure.id === sig.artifact_id)
    const v = visitsRows?.find((visit) => visit.id === p?.visit_instance_id)

    return {
      subjectIdentifier: sub?.subject_identifier || 'Unknown',
      visitName: v?.visit_name || '-',
      procedureName: p?.procedure_name || '-',
      signatureType: sig.artifact_type,
      signatureMeaning: sig.signature_meaning || '-',
      signerRole: sig.signer_role_snapshot || '-',
      signedAt: sig.signed_at || '-',
      artifactHash: sig.signed_artifact_hash || '-',
      status: sig.status,
    }
  })

  const documents: CRAMonitoringDocumentLineageItem[] = []

  for (const consent of consentVersions) {
    const subject = subjectById.get(consent.study_subject_id)
    const consentDoc = consent.consent_document_versions
    const consentFamilyRows = consentVersionsBySubject[consent.study_subject_id] ?? []

    documents.push({
      subjectIdentifier: subject?.subject_identifier || 'Unknown',
      documentType: consent.consent_type,
      currentVersion: consent.consent_version_label || '-',
      versionUsed: asText(consentDoc?.version_number ?? consent.consent_version_label),
      sourcePackageVersion: '-',
      effectiveDate: asDate(consent.effective_at ?? consentDoc?.effective_date ?? consent.completed_at ?? consent.active_at, consent.created_at),
      executionDate: asDate(consent.completed_at ?? consent.active_at, consent.created_at),
      uploadedAt: consent.created_at,
      uploadedBy: consent.created_by || '-',
      status: consent.status,
      priorVersionsCount: countEarlierRows(consentFamilyRows, consent, 'created_at', (row) => `${row.study_subject_id}:${row.consent_type}`),
    })
  }

  for (const doc of subjectDocuments) {
    const subject = subjectById.get(doc.study_subject_id)
    const visit = doc.visit_id ? visitsRows.find((row) => row.id === doc.visit_id) : undefined
    const sourcePackageVersion = visit?.source_package_id ? asText(sourcePackageById.get(visit.source_package_id)?.package_version) : '-'
    const lineageVersion = doc.compliance_runtime_documents?.operational_display_name ?? doc.file_name

    documents.push({
      subjectIdentifier: subject?.subject_identifier || 'Unknown',
      visitName: visit?.visit_name || undefined,
      procedureName: undefined,
      documentType: doc.document_category,
      currentVersion: lineageVersion,
      versionUsed: sourcePackageVersion !== '-' ? sourcePackageVersion : lineageVersion,
      sourcePackageVersion,
      effectiveDate: asDate(doc.compliance_runtime_documents?.created_at ?? doc.created_at, doc.created_at),
      executionDate: asDate(visit?.started_at ?? doc.created_at, doc.created_at),
      uploadedAt: doc.created_at,
      uploadedBy: doc.uploaded_by || '-',
      status: doc.status,
      priorVersionsCount: countEarlierRows(subjectDocuments, doc, 'created_at', (row) => `${row.study_subject_id}:${row.document_category}:${row.visit_id ?? 'none'}`),
    })
  }

  for (const doc of subjectVisitDocuments) {
    const subject = subjectById.get(doc.study_subject_id)
    const visit = visitById.get(doc.subject_visit_id)
    const sourcePackageVersion = visit?.source_package_id ? asText(sourcePackageById.get(visit.source_package_id)?.package_version) : '-'

    documents.push({
      subjectIdentifier: subject?.subject_identifier || 'Unknown',
      visitName: visit?.visit_name || undefined,
      procedureName: undefined,
      documentType: doc.document_type,
      currentVersion: doc.file_name,
      versionUsed: sourcePackageVersion !== '-' ? sourcePackageVersion : doc.file_name,
      sourcePackageVersion,
      effectiveDate: doc.uploaded_at,
      executionDate: asDate(visit?.started_at ?? doc.uploaded_at, doc.uploaded_at),
      uploadedAt: doc.uploaded_at,
      uploadedBy: doc.uploaded_by || '-',
      status: visit?.visit_status || 'available',
      priorVersionsCount: countEarlierRows(subjectVisitDocuments, doc, 'uploaded_at', (row) => `${row.study_subject_id}:${row.document_type}:${row.subject_visit_id}`),
    })
  }

  return {
    workbookName: 'CRA Monitoring Workbook',
    studyName: study.name,
    protocolNumber: study.slug || study.name || '-',
    site: org?.name || 'Unknown Site',
    generatedAt: new Date().toISOString(),
    generatedBy: run.runBy,
    asOfDate,
    audience: 'CRA',
    scopeSummary: scopeFilters.subjectId ? `Subject: ${scopeFilters.subjectId}` : 'All Subjects',
    subjectCount: subjects.length,
    visitCount: visits.length,
    versionLogic: 'ALL_EXECUTED_VERSIONS',
    deliverableRunId: run.id,
    subjects,
    visits,
    procedures,
    consents,
    signatures,
    documents,
  }
}
