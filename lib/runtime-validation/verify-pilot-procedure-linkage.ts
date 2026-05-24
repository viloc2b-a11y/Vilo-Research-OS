import { PILOT_FIXTURE_DEFAULTS } from '@/lib/runtime-validation/pilot-fixture-defaults'
import { verifyPilotProcedureSourceBinding } from '@/lib/runtime-validation/verify-pilot-source-binding'
import { resolveSourceEngineRuntimeConfig } from '@/lib/source-engine/resolution/source-template-resolver'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PilotProcedureLinkageStatus = {
  ok: boolean
  visitId: string
  procedureExecutionId: string | null
  capturePath: string | null
  procedureDefinitionId: string
  peSourceDefinitionVersionId: string | null
  bindingSourceDefinitionVersionId: string | null
  sdvAlignedWithBinding: boolean
  resolutionSource: string | null
  resolutionFallback: boolean
  message: string
}

/**
 * Verify visit → procedure_execution → binding → published SDV → capture route.
 */
export async function verifyPilotProcedureLinkage(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  studySubjectId?: string
  procedureDefinitionId?: string
}): Promise<PilotProcedureLinkageStatus> {
  const procedureDefinitionId =
    input.procedureDefinitionId ?? PILOT_FIXTURE_DEFAULTS.screeningProcedureDefinitionId
  const visitId = input.visitId

  const binding = await verifyPilotProcedureSourceBinding({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    procedureDefinitionId,
  })

  const { data: visit, error: visitErr } = await input.supabase
    .from('visits')
    .select('id, visit_status, study_subject_id, organization_id')
    .eq('id', visitId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (visitErr || !visit) {
    return {
      ok: false,
      visitId,
      procedureExecutionId: null,
      capturePath: null,
      procedureDefinitionId,
      peSourceDefinitionVersionId: null,
      bindingSourceDefinitionVersionId: binding.sourceDefinitionVersionId,
      sdvAlignedWithBinding: false,
      resolutionSource: null,
      resolutionFallback: true,
      message: visitErr?.message ?? 'Visit not found for organization.',
    }
  }

  if (
    input.studySubjectId &&
    (visit.study_subject_id as string) !== input.studySubjectId
  ) {
    return {
      ok: false,
      visitId,
      procedureExecutionId: null,
      capturePath: null,
      procedureDefinitionId,
      peSourceDefinitionVersionId: null,
      bindingSourceDefinitionVersionId: binding.sourceDefinitionVersionId,
      sdvAlignedWithBinding: false,
      resolutionSource: null,
      resolutionFallback: true,
      message: 'Visit does not belong to pilot subject.',
    }
  }

  const { data: procedures, error: peErr } = await input.supabase
    .from('procedure_executions')
    .select('id, procedure_definition_id, source_definition_version_id, execution_status')
    .eq('visit_id', visitId)
    .eq('organization_id', input.organizationId)
    .eq('procedure_definition_id', procedureDefinitionId)
    .order('created_at', { ascending: true })

  if (peErr) {
    return {
      ok: false,
      visitId,
      procedureExecutionId: null,
      capturePath: null,
      procedureDefinitionId,
      peSourceDefinitionVersionId: null,
      bindingSourceDefinitionVersionId: binding.sourceDefinitionVersionId,
      sdvAlignedWithBinding: false,
      resolutionSource: null,
      resolutionFallback: true,
      message: peErr.message,
    }
  }

  const screeningPe = procedures?.[0] ?? null
  if (!screeningPe?.id) {
    return {
      ok: false,
      visitId,
      procedureExecutionId: null,
      capturePath: null,
      procedureDefinitionId,
      peSourceDefinitionVersionId: null,
      bindingSourceDefinitionVersionId: binding.sourceDefinitionVersionId,
      sdvAlignedWithBinding: false,
      resolutionSource: null,
      resolutionFallback: true,
      message:
        'No procedure_execution on Screening visit — run npm run runtime:pilot-staging-prep',
    }
  }

  const peSdv = (screeningPe.source_definition_version_id as string | null) ?? null
  const bindingSdv = binding.sourceDefinitionVersionId
  const sdvAligned =
    Boolean(peSdv && bindingSdv && peSdv === bindingSdv)

  if (!peSdv) {
    return {
      ok: false,
      visitId,
      procedureExecutionId: screeningPe.id as string,
      capturePath: `/source/capture/${screeningPe.id as string}`,
      procedureDefinitionId,
      peSourceDefinitionVersionId: null,
      bindingSourceDefinitionVersionId: bindingSdv,
      sdvAlignedWithBinding: false,
      resolutionSource: null,
      resolutionFallback: true,
      message: 'Procedure execution has no source_definition_version_id.',
    }
  }

  const { data: peSdvRow } = await input.supabase
    .from('source_definition_versions')
    .select('lifecycle_status')
    .eq('id', peSdv)
    .maybeSingle()

  if (peSdvRow?.lifecycle_status !== 'published') {
    return {
      ok: false,
      visitId,
      procedureExecutionId: screeningPe.id as string,
      capturePath: `/source/capture/${screeningPe.id as string}`,
      procedureDefinitionId,
      peSourceDefinitionVersionId: peSdv,
      bindingSourceDefinitionVersionId: bindingSdv,
      sdvAlignedWithBinding: sdvAligned,
      resolutionSource: null,
      resolutionFallback: true,
      message: `PE SDV ${peSdv} is not published (${peSdvRow?.lifecycle_status ?? 'missing'}).`,
    }
  }

  const runtimeConfig = await resolveSourceEngineRuntimeConfig(
    {
      procedureExecutionId: screeningPe.id as string,
      sourceDefinitionVersionId: peSdv,
      organizationId: input.organizationId,
      studyId: input.studyId,
    },
    { supabase: input.supabase },
  )

  const capturePath = `/source/capture/${screeningPe.id as string}`
  const resolutionOk =
    !runtimeConfig.resolution.fallback && runtimeConfig.resolution.source === 'published'

  if (!binding.ok) {
    return {
      ok: false,
      visitId,
      procedureExecutionId: screeningPe.id as string,
      capturePath,
      procedureDefinitionId,
      peSourceDefinitionVersionId: peSdv,
      bindingSourceDefinitionVersionId: bindingSdv,
      sdvAlignedWithBinding: sdvAligned,
      resolutionSource: runtimeConfig.resolution.source,
      resolutionFallback: runtimeConfig.resolution.fallback,
      message: binding.message,
    }
  }

  if (!resolutionOk) {
    return {
      ok: false,
      visitId,
      procedureExecutionId: screeningPe.id as string,
      capturePath,
      procedureDefinitionId,
      peSourceDefinitionVersionId: peSdv,
      bindingSourceDefinitionVersionId: bindingSdv,
      sdvAlignedWithBinding: sdvAligned,
      resolutionSource: runtimeConfig.resolution.source,
      resolutionFallback: runtimeConfig.resolution.fallback,
      message: `Source engine resolution degraded (source=${runtimeConfig.resolution.source}, fallback=${runtimeConfig.resolution.fallback}).`,
    }
  }

  const driftNote = sdvAligned
    ? 'Linkage complete.'
    : `PE SDV ${peSdv} differs from binding ${bindingSdv}; capture uses PE-bound published SDV (pre-capture rows may exist).`

  return {
    ok: true,
    visitId,
    procedureExecutionId: screeningPe.id as string,
    capturePath,
    procedureDefinitionId,
    peSourceDefinitionVersionId: peSdv,
    bindingSourceDefinitionVersionId: bindingSdv,
    sdvAlignedWithBinding: sdvAligned,
    resolutionSource: runtimeConfig.resolution.source,
    resolutionFallback: runtimeConfig.resolution.fallback,
    message: driftNote,
  }
}
