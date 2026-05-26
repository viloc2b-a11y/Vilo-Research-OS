import type { SupabaseClient } from '@supabase/supabase-js'
import { appendVisitRuntimeEvent, buildStateSnapshot } from './append-visit-runtime-event'
import {
  mapProcedureRuntimeInstanceRow,
  mapVisitRuntimeInstanceRow,
  VISIT_RUNTIME_EVENT_TYPE,
  type CreateVisitInstanceInput,
  type ProcedureRuntimeInstanceRow,
  type VisitRuntimeInstanceRow,
} from './visit-runtime-types'

const EXECUTABLE_PACKAGE_STATUSES = new Set(['reviewed', 'approved'])

export type CreateVisitInstanceFromShellArgs = {
  supabase: SupabaseClient
  input: CreateVisitInstanceInput
  createdBy: string
}

export type CreateVisitInstanceFromShellResult = {
  visitInstance: VisitRuntimeInstanceRow
  procedureInstances: ProcedureRuntimeInstanceRow[]
}

async function assertSubjectBelongsToStudy(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  subjectId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('study_subjects')
    .select('id')
    .eq('id', subjectId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Subject not found for this study.')
}

export async function createVisitInstanceFromShell(
  args: CreateVisitInstanceFromShellArgs,
): Promise<CreateVisitInstanceFromShellResult> {
  const { input } = args

  const { data: sourcePackage, error: packageError } = await args.supabase
    .from('runtime_source_packages')
    .select('id, package_status')
    .eq('id', input.source_package_id)
    .eq('organization_id', input.organization_id)
    .eq('study_id', input.study_id)
    .maybeSingle()

  if (packageError) throw new Error(packageError.message)
  if (!sourcePackage) throw new Error('Source package not found.')
  if (!EXECUTABLE_PACKAGE_STATUSES.has(String(sourcePackage.package_status))) {
    throw new Error(
      `Source package must be reviewed or approved before creating visit workspaces (current: ${sourcePackage.package_status}).`,
    )
  }

  const { data: visitShell, error: visitShellError } = await args.supabase
    .from('runtime_source_visit_shells')
    .select('*')
    .eq('id', input.visit_shell_id)
    .eq('source_package_id', input.source_package_id)
    .eq('organization_id', input.organization_id)
    .eq('study_id', input.study_id)
    .maybeSingle()

  if (visitShellError) throw new Error(visitShellError.message)
  if (!visitShell) throw new Error('Visit shell not found for this source package.')

  await assertSubjectBelongsToStudy(
    args.supabase,
    input.organization_id,
    input.study_id,
    input.subject_id,
  )

  const { data: procedureShells, error: procedureShellError } = await args.supabase
    .from('runtime_source_procedure_shells')
    .select('*')
    .eq('visit_shell_id', input.visit_shell_id)
    .eq('source_package_id', input.source_package_id)
    .order('procedure_order', { ascending: true })

  if (procedureShellError) throw new Error(procedureShellError.message)

  const now = new Date().toISOString()

  const { data: visitRow, error: visitInsertError } = await args.supabase
    .from('visit_runtime_instances')
    .insert({
      organization_id: input.organization_id,
      study_id: input.study_id,
      subject_id: input.subject_id,
      source_package_id: input.source_package_id,
      visit_shell_id: input.visit_shell_id,
      runtime_visit_id: visitShell.runtime_visit_id,
      visit_code: visitShell.visit_code,
      visit_name: visitShell.visit_name,
      visit_type: visitShell.visit_type,
      visit_status: 'not_started',
      progress_percent: 0,
      metadata: {},
      created_by: args.createdBy,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (visitInsertError || !visitRow) {
    throw new Error(
      `Failed to create visit runtime instance: ${visitInsertError?.message ?? 'Unknown error'}`,
    )
  }

  const visitInstance = mapVisitRuntimeInstanceRow(visitRow as Record<string, unknown>)
  const procedureInstances: ProcedureRuntimeInstanceRow[] = []

  for (const shell of procedureShells ?? []) {
    const { data: procedureRow, error: procedureInsertError } = await args.supabase
      .from('procedure_runtime_instances')
      .insert({
        organization_id: input.organization_id,
        study_id: input.study_id,
        subject_id: input.subject_id,
        visit_instance_id: visitInstance.id,
        source_package_id: input.source_package_id,
        visit_shell_id: input.visit_shell_id,
        procedure_shell_id: shell.id,
        procedure_id: shell.procedure_id,
        blueprint_version_id: shell.blueprint_version_id,
        procedure_code: shell.procedure_code,
        procedure_name: shell.procedure_name,
        procedure_order: shell.procedure_order,
        required: shell.required,
        procedure_status: 'not_started',
        field_values: {},
        metadata: {},
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (procedureInsertError || !procedureRow) {
      throw new Error(
        `Failed to create procedure runtime instance: ${procedureInsertError?.message ?? 'Unknown error'}`,
      )
    }

    procedureInstances.push(mapProcedureRuntimeInstanceRow(procedureRow as Record<string, unknown>))
  }

  await appendVisitRuntimeEvent({
    supabase: args.supabase,
    organizationId: input.organization_id,
    studyId: input.study_id,
    subjectId: input.subject_id,
    visitInstanceId: visitInstance.id,
    eventType: VISIT_RUNTIME_EVENT_TYPE.VISIT_INSTANCE_CREATED,
    actorId: args.createdBy,
    eventPayload: {
      source_package_id: input.source_package_id,
      visit_shell_id: input.visit_shell_id,
      procedure_count: procedureInstances.length,
    },
    stateSnapshot: buildStateSnapshot({
      visitInstanceId: visitInstance.id,
      visitStatus: visitInstance.visitStatus,
      progressPercent: visitInstance.progressPercent,
      procedures: procedureInstances.map((procedure) => ({
        id: procedure.id,
        procedureStatus: procedure.procedureStatus,
        fieldValues: procedure.fieldValues,
      })),
    }),
  })

  return { visitInstance, procedureInstances }
}
