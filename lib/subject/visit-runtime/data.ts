import type {
  ValidationStatus,
  VisitRuntimeNote,
  VisitRuntimeToolbarModel,
} from '@/lib/subject/visit-runtime/types'
import { createServerClient } from '@/lib/supabase/server'
import type { CaptureShellViewModel } from '@/lib/source/capture/types'
import { getAuditTrail } from '@/lib/visit-runtime/getAuditTrail'
import { validateProcedure } from '@/lib/visit-runtime/validateProcedure'

type ProcedureRuntimeRow = {
  id: string
  organization_id: string
  study_id: string
  visit_id: string
  is_signed?: boolean | null
  signed_at?: string | null
  signed_by?: string | null
  is_locked?: boolean | null
  fields_disabled_at?: string | null
  fields_disabled_by?: string | null
  fields_disabled_reason?: string | null
  section_disabled_at?: string | null
  section_disabled_by?: string | null
  section_disabled_reason?: string | null
  validation_status?: ValidationStatus | null
}

function mapNote(row: Record<string, unknown>): VisitRuntimeNote {
  return {
    id: row.id as string,
    text: row.note_text as string,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

export async function loadVisitRuntimeToolbar(
  model: CaptureShellViewModel,
): Promise<VisitRuntimeToolbarModel> {
  const supabase = await createServerClient()
  const { context } = model

  const [{ data: procedure }, { data: notes }, validation, auditEntries] = await Promise.all([
    supabase
      .from('procedure_executions')
      .select(`
        id,
        organization_id,
        study_id,
        visit_id,
        is_signed,
        signed_at,
        signed_by,
        is_locked,
        fields_disabled_at,
        fields_disabled_by,
        fields_disabled_reason,
        section_disabled_at,
        section_disabled_by,
        section_disabled_reason,
        validation_status
      `)
      .eq('id', context.procedureExecutionId)
      .maybeSingle(),
    supabase
      .from('subject_visit_notes')
      .select('id, note_text, created_by, created_at')
      .eq('procedure_execution_id', context.procedureExecutionId)
      .order('created_at', { ascending: true }),
    validateProcedure({
      supabase,
      procedureExecutionId: context.procedureExecutionId,
      organizationId: context.organizationId,
      responseSetId: model.responseSetId,
    }),
    getAuditTrail({
      supabase,
      procedureExecutionId: context.procedureExecutionId,
      organizationId: context.organizationId,
      responseSetId: model.responseSetId,
    }),
  ])

  const row = procedure as ProcedureRuntimeRow | null
  const missingRequiredCount = validation.alerts.filter((alert) => alert.id.startsWith('required-')).length
  const unresolvedFindingCount = validation.alerts.filter((alert) => !alert.id.startsWith('required-')).length
  const validationStatus: ValidationStatus = validation.status

  return {
    procedureExecutionId: context.procedureExecutionId,
    responseSetId: model.responseSetId,
    organizationId: context.organizationId,
    studyId: context.studyId,
    subjectId: context.studySubjectId,
    visitId: context.visitId,
    isSigned: Boolean(row?.is_signed),
    signedAt: row?.signed_at ?? null,
    signedBy: row?.signed_by ?? null,
    isLocked: Boolean(row?.is_locked),
    fieldsDisabledAt: row?.fields_disabled_at ?? null,
    fieldsDisabledBy: row?.fields_disabled_by ?? null,
    fieldsDisabledReason: row?.fields_disabled_reason ?? null,
    sectionDisabledAt: row?.section_disabled_at ?? null,
    sectionDisabledBy: row?.section_disabled_by ?? null,
    sectionDisabledReason: row?.section_disabled_reason ?? null,
    validationStatus,
    validationAlerts: validation.alerts,
    missingRequiredCount,
    unresolvedFindingCount,
    unsignedSectionCount: row?.is_signed ? 0 : 1,
    notes: (notes ?? []).map((note) => mapNote(note as Record<string, unknown>)),
    auditEntries,
    pdfHref: `/api/procedure-executions/${context.procedureExecutionId}/pdf?organization_id=${context.organizationId}`,
  }
}
