import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { config as loadEnv } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { canExecuteVisit } from '@/lib/subject/consent/guards'
import { createVisitInstanceFromShell } from '@/lib/visit-runtime-execution/create-visit-instance-from-shell'
import { loadVisitWorkspace } from '@/lib/visit-runtime-execution/load-visit-workspace'
import { startVisitInstance } from '@/lib/visit-runtime-execution/start-visit-instance'
import { saveProcedureFieldValues } from '@/lib/visit-runtime-execution/save-procedure-field-values'
import { completeProcedureInstance } from '@/lib/visit-runtime-execution/complete-procedure-instance'
import { completeVisitInstance } from '@/lib/visit-runtime-execution/complete-visit-instance'
import { reviewRuntimeSourcePackage } from '@/lib/runtime-source-package/review-runtime-source-package'
import type { VisitRuntimeInstanceRow } from '@/lib/visit-runtime-execution/visit-runtime-types'

loadEnv({ path: '.env.local' })
loadEnv()

type ProtocolKey = 'VALIDATION_PROTOCOL_001' | 'VALIDATION_PROTOCOL_002'

type ProtocolContext = {
  versionId: string
  studyRuntimeId: string
  studyId: string
  organizationId: string
}

type RuntimeSourcePackage = {
  id: string
  packageVersion: number
  packageHash: string
  packageName: string
  packageStatus: string
}

type StudySubject = {
  id: string
  subjectIdentifier: string
}

type ActorContext = {
  actorUserId: string
  source: 'organization_members' | 'study_members'
}

type VisitShell = {
  id: string
  visitCode: string
  visitName: string
  visitType: string
  sequenceOrder: number
  runtimeVisitId: string
  sourcePackageId: string
}

type ProcedureShell = {
  id: string
  visitShellId: string
  procedureCode: string
  procedureName: string
  procedureOrder: number
  required: boolean
  sourceShellJson: {
    fields?: Array<{
      field_id: string
      label?: string
      type?: string
      required?: boolean
      options?: string[]
    }>
  }
}

type CandidateVisit = {
  subject: StudySubject
  package: RuntimeSourcePackage
  visitShell: VisitShell
  procedureShells: ProcedureShell[]
  existingVisit?: VisitRuntimeInstanceRow | null
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function protocolKeyFromArg(): ProtocolKey {
  const raw = (process.argv[2] || '').trim().toUpperCase()
  if (raw === 'VALIDATION_PROTOCOL_001' || raw === 'VALIDATION_PROTOCOL_002') return raw
  throw new Error('Usage: npx tsx scripts/coordinator-execution-ux-readiness-smoke.ts VALIDATION_PROTOCOL_001|VALIDATION_PROTOCOL_002')
}

function writeReport(reportStem: string, payload: unknown) {
  const outDir = path.resolve(__dirname, '..', '.runtime-validation')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `${reportStem}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  fs.writeFileSync(
    path.join(outDir, `${reportStem}.md`),
    `# ${reportStem}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`,
    'utf8',
  )
  return {
    jsonPath: path.join(outDir, `${reportStem}.json`),
    mdPath: path.join(outDir, `${reportStem}.md`),
  }
}

function makeSampleValue(field: { field_id: string; type?: string; options?: string[] }, index: number) {
  const type = String(field.type ?? '').toLowerCase()
  const options = field.options ?? []
  if (options.length > 0) return options[0]
  if (type.includes('number') || type.includes('integer') || type.includes('numeric')) {
    return index + 1
  }
  if (type.includes('date') && !type.includes('datetime')) {
    return new Date().toISOString().slice(0, 10)
  }
  if (type.includes('datetime')) {
    return new Date().toISOString()
  }
  if (type.includes('bool') || type.includes('check')) {
    return true
  }
  if (type.includes('json') || type.includes('object') || type.includes('table')) {
    return { smoke: true, field_key: field.field_id }
  }
  return `SMOKE-${field.field_id}-${index + 1}`
}

async function loadProtocolContext(supabase: SupabaseClient, protocol: ProtocolKey): Promise<ProtocolContext> {
  const { data: versions, error } = await supabase
    .from('protocol_runtime_versions')
    .select('id, protocol_runtime_study_id, extraction_status, extraction_metadata')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error

  for (const version of versions ?? []) {
    const { data: study, error: studyError } = await supabase
      .from('protocol_runtime_studies')
      .select('id, organization_id, study_id, protocol_number')
      .eq('id', String(version.protocol_runtime_study_id))
      .maybeSingle()
    if (studyError) throw studyError
    if (study?.protocol_number === protocol) {
      return {
        versionId: String(version.id),
        studyRuntimeId: String(study.id),
        studyId: String(study.study_id),
        organizationId: String(study.organization_id),
      }
    }
  }

  throw new Error(`No protocol runtime study found for ${protocol}`)
}

async function loadRuntimeSourcePackages(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<RuntimeSourcePackage[]> {
  const { data, error } = await supabase
    .from('runtime_source_packages')
    .select('id, package_version, package_hash, package_name, package_status')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('package_version', { ascending: false })
    .limit(5)
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: String(row.id),
    packageVersion: Number(row.package_version),
    packageHash: String(row.package_hash),
    packageName: String(row.package_name),
    packageStatus: String(row.package_status),
  }))
}

async function loadSubjects(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<StudySubject[]> {
  const { data, error } = await supabase
    .from('study_subjects')
    .select('id, subject_identifier')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('subject_identifier', { ascending: true })
    .limit(100)
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: String(row.id),
    subjectIdentifier: String(row.subject_identifier),
  }))
}

async function loadActorUserId(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ActorContext> {
  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (orgMember?.user_id) {
    return {
      actorUserId: String(orgMember.user_id),
      source: 'organization_members',
    }
  }

  const { data: studyMember } = await supabase
    .from('study_members')
    .select('user_id')
    .eq('study_id', studyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (studyMember?.user_id) {
    return {
      actorUserId: String(studyMember.user_id),
      source: 'study_members',
    }
  }

  throw new Error('No actor user was found to create coordinator smoke consent data.')
}

async function ensureCoordinatorSmokeSubject(
  supabase: SupabaseClient,
  protocol: ProtocolKey,
  organizationId: string,
  studyId: string,
): Promise<StudySubject> {
  const subjectIdentifier = `${protocol}-COORD-SMOKE`
  const now = new Date().toISOString()
  const actor = await loadActorUserId(supabase, organizationId, studyId)

  const { data: existing, error: existingError } = await supabase
    .from('study_subjects')
    .select('id, subject_identifier')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('subject_identifier', subjectIdentifier)
    .maybeSingle()
  if (existingError) throw existingError

  let subjectId = existing?.id ? String(existing.id) : ''
  if (!subjectId) {
    const { data: created, error: createError } = await supabase
      .from('study_subjects')
      .insert({
        organization_id: organizationId,
        study_id: studyId,
        subject_identifier: subjectIdentifier,
        enrollment_status: 'enrolled',
        consented_at: now,
      })
      .select('id, subject_identifier')
      .single()
    if (createError || !created) {
      throw new Error(`Failed to create coordinator smoke subject: ${createError?.message ?? 'Unknown error'}`)
    }
    subjectId = String(created.id)
  }

  const { data: activeConsent } = await supabase
    .from('subject_consent_versions')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('study_subject_id', subjectId)
    .eq('consent_type', 'initial_consent')
    .eq('status', 'active')
    .maybeSingle()

  if (!activeConsent) {
    const { error: consentError } = await supabase.from('subject_consent_versions').insert({
      organization_id: organizationId,
      study_id: studyId,
      study_subject_id: subjectId,
      consent_type: 'initial_consent',
      consent_version_label: `${protocol} Coordinator Smoke Consent`,
      protocol_version: protocol,
      status: 'active',
      completed_at: now,
      active_at: now,
      requires_pi_review: false,
      created_by: actor.actorUserId,
      metadata: {
        smoke: true,
        source: 'coordinator-execution-ux-readiness-smoke',
        actor_source: actor.source,
      },
    })
    if (consentError) {
      throw new Error(`Failed to create coordinator smoke consent: ${consentError.message}`)
    }
  }

  return {
    id: subjectId,
    subjectIdentifier,
  }
}

async function loadSourceShells(
  supabase: SupabaseClient,
  sourcePackageIds: string[],
): Promise<{
  visitShellsByPackageId: Record<string, VisitShell[]>
  procedureShellsByVisitShellId: Record<string, ProcedureShell[]>
}> {
  const visitShellsByPackageId: Record<string, VisitShell[]> = {}
  const procedureShellsByVisitShellId: Record<string, ProcedureShell[]> = {}

  if (sourcePackageIds.length === 0) {
    return { visitShellsByPackageId, procedureShellsByVisitShellId }
  }

  const { data: visitShellRows, error: visitShellError } = await supabase
    .from('runtime_source_visit_shells')
    .select('id, source_package_id, visit_code, visit_name, visit_type, sequence_order, runtime_visit_id')
    .in('source_package_id', sourcePackageIds)
    .order('sequence_order', { ascending: true })
  if (visitShellError) throw visitShellError

  for (const row of visitShellRows ?? []) {
    const shell: VisitShell = {
      id: String(row.id),
      visitCode: String(row.visit_code),
      visitName: String(row.visit_name),
      visitType: String(row.visit_type),
      sequenceOrder: Number(row.sequence_order),
      runtimeVisitId: String(row.runtime_visit_id),
      sourcePackageId: String(row.source_package_id),
    }
    const pkg = shell.sourcePackageId
    visitShellsByPackageId[pkg] = visitShellsByPackageId[pkg] ?? []
    visitShellsByPackageId[pkg].push(shell)
  }

  const { data: procedureShellRows, error: procedureShellError } = await supabase
    .from('runtime_source_procedure_shells')
    .select('id, source_package_id, visit_shell_id, procedure_code, procedure_name, procedure_order, required, source_shell_json')
    .in('source_package_id', sourcePackageIds)
    .order('procedure_order', { ascending: true })
  if (procedureShellError) throw procedureShellError

  for (const row of procedureShellRows ?? []) {
    const shell: ProcedureShell = {
      id: String(row.id),
      visitShellId: String(row.visit_shell_id),
      procedureCode: String(row.procedure_code),
      procedureName: String(row.procedure_name),
      procedureOrder: Number(row.procedure_order),
      required: Boolean(row.required),
      sourceShellJson: (row.source_shell_json as ProcedureShell['sourceShellJson']) ?? {},
    }
    procedureShellsByVisitShellId[shell.visitShellId] = procedureShellsByVisitShellId[shell.visitShellId] ?? []
    procedureShellsByVisitShellId[shell.visitShellId].push(shell)
  }

  return { visitShellsByPackageId, procedureShellsByVisitShellId }
}

async function findCandidateVisit(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  subjects: StudySubject[],
  packages: RuntimeSourcePackage[],
  visitShellsByPackageId: Record<string, VisitShell[]>,
  procedureShellsByVisitShellId: Record<string, ProcedureShell[]>,
): Promise<CandidateVisit> {
  for (const subject of subjects) {
    const consent = await canExecuteVisit(supabase, { subjectId: subject.id, studyId })
    if (!consent.ok) continue

    for (const pkg of packages) {
      const shells = (visitShellsByPackageId[pkg.id] ?? []).slice().sort((a, b) => {
        const aCount = procedureShellsByVisitShellId[a.id]?.length ?? 0
        const bCount = procedureShellsByVisitShellId[b.id]?.length ?? 0
        return aCount - bCount || a.sequenceOrder - b.sequenceOrder
      })

      for (const visitShell of shells) {
        const procedureShells = procedureShellsByVisitShellId[visitShell.id] ?? []
        if (procedureShells.length === 0) continue

        const { data: existingVisit, error: existingError } = await supabase
          .from('visit_runtime_instances')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('study_id', studyId)
          .eq('subject_id', subject.id)
          .eq('source_package_id', pkg.id)
          .eq('visit_shell_id', visitShell.id)
          .maybeSingle()
        if (existingError) throw existingError
        if (existingVisit && String(existingVisit.visit_status).toLowerCase() === 'completed') {
          continue
        }

        return {
          subject,
          package: pkg,
          visitShell,
          procedureShells,
          existingVisit: existingVisit ? (existingVisit as VisitRuntimeInstanceRow) : null,
        }
      }
    }
  }

  throw new Error(`No coordinator-ready visit candidate found for study ${studyId}`)
}

function buildFieldValues(procedureShell: ProcedureShell): Record<string, unknown> {
  const fields = procedureShell.sourceShellJson.fields ?? []
  const values: Record<string, unknown> = {}
  fields.forEach((field, index) => {
    values[field.field_id] = makeSampleValue(field, index)
  })
  return values
}

async function executeVisit(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  candidate: CandidateVisit,
) {
  const actorId = randomUUID()
  const createdAt = new Date().toISOString()
  let packageRecord = candidate.package

  if (packageRecord.packageStatus === 'draft') {
    const reviewed = await reviewRuntimeSourcePackage({
      supabase,
      organizationId,
      packageId: packageRecord.id,
      reviewedBy: actorId,
    })
    packageRecord = {
      ...packageRecord,
      packageStatus: reviewed.packageStatus,
    }
  }

  let visitInstance = candidate.existingVisit
  let createdFresh = false

  if (!visitInstance) {
    const created = await createVisitInstanceFromShell({
      supabase,
      input: {
        organization_id: organizationId,
        study_id: studyId,
        subject_id: candidate.subject.id,
        source_package_id: packageRecord.id,
        visit_shell_id: candidate.visitShell.id,
      },
      createdBy: actorId,
      allowUnpublishedSource: true,
    })
    visitInstance = created.visitInstance
    createdFresh = true
  }

  assert(Boolean(visitInstance), 'Visit instance could not be created or loaded.')

  if (String(visitInstance.visitStatus) === 'not_started') {
    visitInstance = await startVisitInstance({
      supabase,
      organizationId,
      visitInstanceId: visitInstance.id,
      actorId,
    })
  }

  const workspaceBefore = await loadVisitWorkspace(supabase, organizationId, visitInstance.id)
  assert(Boolean(workspaceBefore), 'Visit workspace failed to load before execution.')

  const completedProcedureIds: string[] = []
  const savedFieldCounts: Record<string, number> = {}
  const procedureStatusesBefore: Record<string, string> = {}

  for (const procedure of workspaceBefore!.procedureInstances) {
    procedureStatusesBefore[procedure.id] = procedure.procedureStatus
    if (String(procedure.procedureStatus) === 'completed') {
      completedProcedureIds.push(procedure.id)
      continue
    }

    const shell = candidate.procedureShells.find((item) => item.id === procedure.procedureShellId)
    if (!shell) {
      throw new Error(`Missing source shell for procedure ${procedure.id}`)
    }

    const fieldValues = buildFieldValues(shell)
    savedFieldCounts[procedure.id] = Object.keys(fieldValues).length

    await saveProcedureFieldValues({
      supabase,
      organizationId,
      procedureInstanceId: procedure.id,
      fieldValues,
      actorId,
    })

    await completeProcedureInstance({
      supabase,
      organizationId,
      procedureInstanceId: procedure.id,
      actorId,
    })
    completedProcedureIds.push(procedure.id)
  }

  visitInstance = await completeVisitInstance({
    supabase,
    organizationId,
    visitInstanceId: visitInstance.id,
    actorId,
  })

  const finalWorkspace = await loadVisitWorkspace(supabase, organizationId, visitInstance.id)
  assert(Boolean(finalWorkspace), 'Visit workspace failed to load after execution.')

  return {
    actorId,
    createdFresh,
    packageStatusAfter: packageRecord.packageStatus,
    visitInstance,
    workspaceBefore,
    finalWorkspace,
    completedProcedureIds,
    savedFieldCounts,
    procedureStatusesBefore,
    createdAt,
  }
}

async function main() {
  const protocol = protocolKeyFromArg()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  assert(Boolean(url && key), 'Supabase URL and service role key are required.')
  const supabase = createClient(url!, key!)

  const context = await loadProtocolContext(supabase, protocol)
  const packages = await loadRuntimeSourcePackages(supabase, context.organizationId, context.studyId)
  assert(packages.length > 0, `No runtime source package found for ${protocol}`)

  const { visitShellsByPackageId, procedureShellsByVisitShellId } = await loadSourceShells(
    supabase,
    packages.map((pkg) => pkg.id),
  )
  let subjects = await loadSubjects(supabase, context.organizationId, context.studyId)
  let candidate: CandidateVisit | null = null
  try {
    candidate = await findCandidateVisit(
      supabase,
      context.organizationId,
      context.studyId,
      subjects,
      packages,
      visitShellsByPackageId,
      procedureShellsByVisitShellId,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('No coordinator-ready visit candidate')) {
      throw error
    }
    const smokeSubject = await ensureCoordinatorSmokeSubject(
      supabase,
      protocol,
      context.organizationId,
      context.studyId,
    )
    subjects = [...subjects, smokeSubject]
    candidate = await findCandidateVisit(
      supabase,
      context.organizationId,
      context.studyId,
      subjects,
      packages,
      visitShellsByPackageId,
      procedureShellsByVisitShellId,
    )
  }
  assert(Boolean(candidate), `No coordinator-ready visit candidate found for ${protocol}`)

  const selectedCandidate = candidate as CandidateVisit
  const execution = await executeVisit(supabase, context.organizationId, context.studyId, selectedCandidate)

  const report = {
    protocol,
    scope: {
      organization_id: context.organizationId,
      study_id: context.studyId,
      protocol_runtime_version_id: context.versionId,
      protocol_runtime_study_id: context.studyRuntimeId,
    },
    source: {
      source_package_id: selectedCandidate.package.id,
      package_version: selectedCandidate.package.packageVersion,
      package_name: selectedCandidate.package.packageName,
      package_status_before: selectedCandidate.package.packageStatus,
      package_status_after: execution.packageStatusAfter,
      package_hash: selectedCandidate.package.packageHash,
      visit_shell_id: selectedCandidate.visitShell.id,
      visit_code: selectedCandidate.visitShell.visitCode,
      visit_name: selectedCandidate.visitShell.visitName,
      visit_type: selectedCandidate.visitShell.visitType,
      procedure_shell_count: selectedCandidate.procedureShells.length,
    },
    subject: {
      subject_id: selectedCandidate.subject.id,
      subject_identifier: selectedCandidate.subject.subjectIdentifier,
    },
    execution: {
      created_fresh: execution.createdFresh,
      actor_id: execution.actorId,
      visit_instance_id: execution.visitInstance.id,
      visit_status_before: execution.workspaceBefore?.visitInstance.visitStatus ?? null,
      visit_status_after: execution.finalWorkspace?.visitInstance.visitStatus ?? null,
      progress_percent_after: execution.finalWorkspace?.visitInstance.progressPercent ?? null,
      procedure_instance_count: execution.finalWorkspace?.procedureInstances.length ?? null,
      completed_procedure_ids: execution.completedProcedureIds,
      saved_field_counts: execution.savedFieldCounts,
      procedure_statuses_before: execution.procedureStatusesBefore,
      event_count: execution.finalWorkspace?.events.length ?? null,
      workspace_loaded_before: Boolean(execution.workspaceBefore),
      workspace_loaded_after: Boolean(execution.finalWorkspace),
    },
    passes: {
      visit_created_or_reused: Boolean(execution.visitInstance),
      procedures_completed:
        (execution.finalWorkspace?.procedureInstances ?? []).every((procedure) =>
          ['completed', 'skipped', 'not_applicable'].includes(String(procedure.procedureStatus)),
        ),
      visit_completed: String(execution.finalWorkspace?.visitInstance.visitStatus ?? '').toLowerCase() === 'completed',
      workspace_renderable: Boolean(execution.finalWorkspace),
    },
    remaining_blockers: [] as string[],
  }

  const reportStem = `coordinator-execution-ux-readiness-${protocol.toLowerCase()}`
  const reportPaths = writeReport(reportStem, report)
  console.log(
    JSON.stringify(
      {
        protocol,
        reportPaths,
        report,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
