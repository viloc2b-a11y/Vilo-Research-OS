/**
 * GOV-1 — Resolve workflow authority escalation rules for an organization.
 * Resolution: org-specific active rules → global active rules → empty array.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { assertWorkflowKey, type WorkflowKey } from '@/lib/governance/workflow-authority/constants'
import {
  mapWorkflowAuthorityEscalationRuleRow,
  type WorkflowAuthorityEscalationRule,
  type WorkflowAuthorityEscalationRuleRow,
} from '@/lib/governance/workflow-authority/types'

const ESCALATION_SELECT =
  'id, organization_id, workflow_key, rule_key, condition_type, condition_expression, from_authority_level, to_authority_level, requires_human_confirmation, system_blocking, regulated, audit_required, active, notes, created_at, updated_at'

async function loadActiveEscalationRules(input: {
  supabase: SupabaseClient
  organizationId: string | null
  workflowKey: string
}): Promise<WorkflowAuthorityEscalationRule[]> {
  let query = input.supabase
    .from('workflow_authority_escalation_rules')
    .select(ESCALATION_SELECT)
    .eq('workflow_key', input.workflowKey)
    .eq('active', true)
    .order('rule_key', { ascending: true })

  if (input.organizationId === null) {
    query = query.is('organization_id', null)
  } else {
    query = query.eq('organization_id', input.organizationId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(
      `Failed to load workflow escalation rules for "${input.workflowKey}": ${error.message}`,
    )
  }

  return (data ?? []).map((row) =>
    mapWorkflowAuthorityEscalationRuleRow(row as WorkflowAuthorityEscalationRuleRow),
  )
}

export async function getWorkflowEscalationRules(input: {
  supabase: SupabaseClient
  organizationId: string
  workflowKey: WorkflowKey
}): Promise<WorkflowAuthorityEscalationRule[]> {
  assertWorkflowKey(input.workflowKey)

  const orgRules = await loadActiveEscalationRules({
    supabase: input.supabase,
    organizationId: input.organizationId,
    workflowKey: input.workflowKey,
  })
  if (orgRules.length > 0) return orgRules

  return loadActiveEscalationRules({
    supabase: input.supabase,
    organizationId: null,
    workflowKey: input.workflowKey,
  })
}
