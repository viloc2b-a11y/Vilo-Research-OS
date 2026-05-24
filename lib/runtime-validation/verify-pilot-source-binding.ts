import { PILOT_FIXTURE_DEFAULTS } from '@/lib/runtime-validation/pilot-fixture-defaults'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PilotSourceBindingStatus = {
  ok: boolean
  bindingId: string | null
  sourceDefinitionVersionId: string | null
  lifecycleStatus: string | null
  message: string
}

/**
 * Verify Screening CBC uses published SDV binding (not dev fallback).
 */
export async function verifyPilotProcedureSourceBinding(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  procedureDefinitionId?: string
  expectedSourceDefinitionVersionId?: string
}): Promise<PilotSourceBindingStatus> {
  const procedureDefinitionId =
    input.procedureDefinitionId ?? PILOT_FIXTURE_DEFAULTS.screeningProcedureDefinitionId
  const expectedSdv =
    input.expectedSourceDefinitionVersionId ??
    PILOT_FIXTURE_DEFAULTS.canonicalSourceDefinitionVersionId

  const { data: binding, error } = await input.supabase
    .from('procedure_source_bindings')
    .select('id, default_source_definition_version_id')
    .eq('study_id', input.studyId)
    .eq('organization_id', input.organizationId)
    .eq('procedure_definition_id', procedureDefinitionId)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      bindingId: null,
      sourceDefinitionVersionId: null,
      lifecycleStatus: null,
      message: error.message,
    }
  }

  if (!binding?.default_source_definition_version_id) {
    return {
      ok: false,
      bindingId: binding?.id ?? null,
      sourceDefinitionVersionId: null,
      lifecycleStatus: null,
      message:
        'No procedure_source_bindings row for Screening CBC — run node scripts/phase9a-staging-hygiene.mjs',
    }
  }

  const sdvId = binding.default_source_definition_version_id as string
  const { data: sdv } = await input.supabase
    .from('source_definition_versions')
    .select('lifecycle_status')
    .eq('id', sdvId)
    .maybeSingle()

  const lifecycleStatus = (sdv?.lifecycle_status as string) ?? null
  const published = lifecycleStatus === 'published'
  const matchesCanonical = sdvId === expectedSdv

  if (!published) {
    return {
      ok: false,
      bindingId: binding.id as string,
      sourceDefinitionVersionId: sdvId,
      lifecycleStatus,
      message: `Bound SDV ${sdvId} is not published (${lifecycleStatus ?? 'unknown'}).`,
    }
  }

  if (!matchesCanonical) {
    return {
      ok: false,
      bindingId: binding.id as string,
      sourceDefinitionVersionId: sdvId,
      lifecycleStatus,
      message: `Bound SDV ${sdvId} does not match canonical pilot SDV ${expectedSdv}.`,
    }
  }

  return {
    ok: true,
    bindingId: binding.id as string,
    sourceDefinitionVersionId: sdvId,
    lifecycleStatus,
    message: 'Screening CBC bound to published canonical SDV.',
  }
}
