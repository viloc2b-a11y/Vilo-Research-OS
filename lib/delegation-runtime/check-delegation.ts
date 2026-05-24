/**
 * Delegation runtime check v0 — read/check foundation only (no invented delegation records).
 */

import {
  DELEGATION_CHECK_RESULT,
  DELEGATION_RUNTIME_OUTCOME,
} from '@/lib/delegation-runtime/constants'
import type {
  DelegationRuntimeCheckInput,
  DelegationRuntimeCheckOutcome,
  ProcedureDelegationRequirement,
} from '@/lib/delegation-runtime/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export function checkDelegationRuntime(
  input: DelegationRuntimeCheckInput,
): DelegationRuntimeCheckOutcome {
  const requirement = input.requirement

  if (!requirement || !requirement.active) {
    return {
      outcome: DELEGATION_RUNTIME_OUTCOME.UNKNOWN,
      checkResult: DELEGATION_CHECK_RESULT.UNKNOWN,
      requiresDelegation: false,
      requiresPiDelegation: false,
      regulated: false,
      systemBlocking: false,
      reason: 'no active delegation requirement',
    }
  }

  if (!requirement.requiresDelegation && !requirement.requiresPiDelegation) {
    return {
      outcome: DELEGATION_RUNTIME_OUTCOME.DELEGATED,
      checkResult: DELEGATION_CHECK_RESULT.DELEGATED,
      requiresDelegation: false,
      requiresPiDelegation: false,
      regulated: requirement.regulated,
      systemBlocking: false,
      reason: null,
    }
  }

  if (input.delegated) {
    return {
      outcome: DELEGATION_RUNTIME_OUTCOME.DELEGATED,
      checkResult: DELEGATION_CHECK_RESULT.DELEGATED,
      requiresDelegation: requirement.requiresDelegation,
      requiresPiDelegation: requirement.requiresPiDelegation,
      regulated: requirement.regulated,
      systemBlocking: false,
      reason: null,
    }
  }

  const shouldBlock =
    input.enforce === true &&
    requirement.regulated &&
    requirement.requiresPiDelegation &&
    requirement.blockingIfMissing

  if (shouldBlock) {
    return {
      outcome: DELEGATION_RUNTIME_OUTCOME.BLOCKED,
      checkResult: DELEGATION_CHECK_RESULT.NOT_DELEGATED,
      requiresDelegation: requirement.requiresDelegation,
      requiresPiDelegation: requirement.requiresPiDelegation,
      regulated: requirement.regulated,
      systemBlocking: true,
      reason: `procedure "${requirement.procedureKey}" requires PI delegation (enforce=true)`,
    }
  }

  return {
    outcome: DELEGATION_RUNTIME_OUTCOME.WARNING,
    checkResult: DELEGATION_CHECK_RESULT.NOT_DELEGATED,
    requiresDelegation: requirement.requiresDelegation,
    requiresPiDelegation: requirement.requiresPiDelegation,
    regulated: requirement.regulated,
    systemBlocking: false,
    reason: `procedure "${requirement.procedureKey}" delegation not recorded`,
  }
}

function mapRequirementRow(row: Record<string, unknown>): ProcedureDelegationRequirement {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    studyId: (row.study_id as string | null) ?? null,
    studyVersionId: (row.study_version_id as string | null) ?? null,
    procedureKey: row.procedure_key as string,
    workflowKey: (row.workflow_key as ProcedureDelegationRequirement['workflowKey']) ?? null,
    requiresDelegation: row.requires_delegation as boolean,
    requiresPiDelegation: row.requires_pi_delegation as boolean,
    regulated: row.regulated as boolean,
    blockingIfMissing: row.blocking_if_missing as boolean,
    active: row.active as boolean,
    notes: (row.notes as string | null) ?? null,
  }
}

export async function resolveProcedureDelegationRequirement(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  procedureKey: string
}): Promise<ProcedureDelegationRequirement | null> {
  const { data: studyRow } = await input.supabase
    .from('procedure_delegation_requirements')
    .select(
      'id, organization_id, study_id, study_version_id, procedure_key, workflow_key, requires_delegation, requires_pi_delegation, regulated, blocking_if_missing, active, notes',
    )
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .eq('procedure_key', input.procedureKey)
    .eq('active', true)
    .maybeSingle()

  if (studyRow) return mapRequirementRow(studyRow as Record<string, unknown>)

  const { data: globalRow } = await input.supabase
    .from('procedure_delegation_requirements')
    .select(
      'id, organization_id, study_id, study_version_id, procedure_key, workflow_key, requires_delegation, requires_pi_delegation, regulated, blocking_if_missing, active, notes',
    )
    .is('organization_id', null)
    .is('study_id', null)
    .eq('procedure_key', input.procedureKey)
    .eq('active', true)
    .maybeSingle()

  if (globalRow) return mapRequirementRow(globalRow as Record<string, unknown>)
  return null
}
