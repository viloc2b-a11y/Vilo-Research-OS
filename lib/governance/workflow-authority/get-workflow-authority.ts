/**
 * GOV-1 — Resolve workflow decision authority for an organization.
 * Resolution: org-specific active → global active (organization_id IS NULL) → throw.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { assertWorkflowKey, type WorkflowKey } from '@/lib/governance/workflow-authority/constants'
import {
  mapWorkflowDecisionAuthorityRow,
  type WorkflowDecisionAuthority,
  type WorkflowDecisionAuthorityRow,
} from '@/lib/governance/workflow-authority/types'

export class WorkflowDecisionAuthorityNotFoundError extends Error {
  readonly organizationId: string
  readonly workflowKey: string

  constructor(organizationId: string, workflowKey: string) {
    super(
      `No active workflow decision authority for workflow_key="${workflowKey}" ` +
        `(organization_id="${organizationId}" or global default).`,
    )
    this.name = 'WorkflowDecisionAuthorityNotFoundError'
    this.organizationId = organizationId
    this.workflowKey = workflowKey
  }
}

const AUTHORITY_SELECT =
  'id, organization_id, workflow_key, category, base_authority_level, ai_allowed, human_confirmation_required, system_blocking, regulated, phi_sensitive, audit_required, conditional_escalation_supported, notes, active, created_at, updated_at'

async function loadActiveAuthority(input: {
  supabase: SupabaseClient
  organizationId: string | null
  workflowKey: string
}): Promise<WorkflowDecisionAuthority | null> {
  let query = input.supabase
    .from('workflow_decision_authorities')
    .select(AUTHORITY_SELECT)
    .eq('workflow_key', input.workflowKey)
    .eq('active', true)

  if (input.organizationId === null) {
    query = query.is('organization_id', null)
  } else {
    query = query.eq('organization_id', input.organizationId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    throw new Error(
      `Failed to load workflow decision authority for "${input.workflowKey}": ${error.message}`,
    )
  }
  if (!data) return null
  return mapWorkflowDecisionAuthorityRow(data as WorkflowDecisionAuthorityRow)
}

export async function getWorkflowAuthority(input: {
  supabase: SupabaseClient
  organizationId: string
  workflowKey: WorkflowKey
}): Promise<WorkflowDecisionAuthority> {
  assertWorkflowKey(input.workflowKey)

  const orgSpecific = await loadActiveAuthority({
    supabase: input.supabase,
    organizationId: input.organizationId,
    workflowKey: input.workflowKey,
  })
  if (orgSpecific) return orgSpecific

  const globalDefault = await loadActiveAuthority({
    supabase: input.supabase,
    organizationId: null,
    workflowKey: input.workflowKey,
  })
  if (globalDefault) return globalDefault

  throw new WorkflowDecisionAuthorityNotFoundError(
    input.organizationId,
    input.workflowKey,
  )
}
