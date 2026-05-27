import type { BuildVisitSnapshotInput, VisitSnapshotJson } from './visit-locking-types'

export function buildVisitSnapshot(input: BuildVisitSnapshotInput): VisitSnapshotJson {
  const procedures = [...input.procedures]
    .sort((a, b) => a.procedureOrder - b.procedureOrder || a.id.localeCompare(b.id))
    .map((procedure) => ({
      procedure_instance_id: procedure.id,
      procedure_code: procedure.procedureCode,
      procedure_name: procedure.procedureName,
      blueprint_version_id: procedure.blueprintVersionId,
      procedure_status: procedure.procedureStatus,
      field_values: procedure.fieldValues,
      completed_at: procedure.completedAt,
    }))

  const events = input.events.map((event) => ({
    event_type: event.eventType,
    event_timestamp: event.eventTimestamp,
    state_hash: event.stateHash,
  }))

  return {
    visit_instance: {
      id: input.visitInstance.id,
      subject_id: input.visitInstance.subjectId,
      visit_code: input.visitInstance.visitCode,
      visit_name: input.visitInstance.visitName,
      visit_status: input.visitInstance.visitStatus,
      progress_percent: input.visitInstance.progressPercent,
      started_at: input.visitInstance.startedAt,
      completed_at: input.visitInstance.completedAt,
    },
    procedures,
    events,
    source_context: {
      source_publication_id: input.visitInstance.sourcePublicationId ?? null,
      source_publication_version: input.visitInstance.sourcePublicationVersion ?? null,
      source_package_hash: input.visitInstance.sourcePackageHash ?? null,
      source_package_id: input.visitInstance.sourcePackageId,
      visit_shell_id: input.visitInstance.visitShellId,
      runtime_visit_id: input.visitInstance.runtimeVisitId,
    },
  }
}
