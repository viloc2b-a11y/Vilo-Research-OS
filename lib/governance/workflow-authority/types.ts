/**
 * GOV-1 — Workflow decision authority matrix types (static classification v1).
 */

import {
  isWorkflowAuthorityLevel,
  isWorkflowEscalationConditionType,
  isWorkflowKey,
  type EffectiveAuthorityLevel,
  type WorkflowAuthorityLevel,
  type WorkflowEscalationConditionType,
  type WorkflowKey,
} from '@/lib/governance/workflow-authority/constants'

export type {
  EffectiveAuthorityLevel,
  Gov1SeededWorkflowKey,
  WorkflowAuthorityLevel,
  WorkflowCategory,
  WorkflowEscalationConditionType,
  WorkflowEscalationRuleKey,
  WorkflowKey,
  WorkflowRegistryActive,
} from '@/lib/governance/workflow-authority/constants'

export {
  assertWorkflowAuthorityLevel,
  assertWorkflowKey,
  EFFECTIVE_AUTHORITY_LEVEL,
  GOV1_SEEDED_WORKFLOW_KEYS,
  WORKFLOW_AUTHORITY_LEVEL,
  WORKFLOW_AUTHORITY_LEVELS,
  WORKFLOW_CATEGORIES,
  WORKFLOW_CATEGORY,
  WORKFLOW_ESCALATION_CONDITION_TYPE,
  WORKFLOW_ESCALATION_CONDITION_TYPES,
  WORKFLOW_ESCALATION_RULE_KEY,
  WORKFLOW_ESCALATION_RULE_KEYS,
  WORKFLOW_KEY,
  WORKFLOW_KEYS,
  WORKFLOW_REGISTRY_ACTIVE,
  isWorkflowAuthorityLevel,
  isWorkflowCategory,
  isWorkflowEscalationConditionType,
  isWorkflowKey,
} from '@/lib/governance/workflow-authority/constants'

export type WorkflowDecisionAuthority = {
  id: string
  organizationId: string | null
  workflowKey: WorkflowKey
  category: string
  baseAuthorityLevel: WorkflowAuthorityLevel
  aiAllowed: boolean
  humanConfirmationRequired: boolean
  systemBlocking: boolean
  regulated: boolean
  phiSensitive: boolean
  auditRequired: boolean
  conditionalEscalationSupported: boolean
  notes: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type WorkflowAuthorityEscalationRule = {
  id: string
  organizationId: string | null
  workflowKey: WorkflowKey
  ruleKey: string
  conditionType: WorkflowEscalationConditionType
  /** Immutable once referenced — historical governance metadata only. */
  conditionExpression: Record<string, unknown>
  fromAuthorityLevel: WorkflowAuthorityLevel
  toAuthorityLevel: WorkflowAuthorityLevel
  requiresHumanConfirmation: boolean
  systemBlocking: boolean
  regulated: boolean
  auditRequired: boolean
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type WorkflowDecisionAuthorityRow = {
  id: string
  organization_id: string | null
  workflow_key: string
  category: string
  base_authority_level: string
  ai_allowed: boolean
  human_confirmation_required: boolean
  system_blocking: boolean
  regulated: boolean
  phi_sensitive: boolean
  audit_required: boolean
  conditional_escalation_supported: boolean
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type WorkflowAuthorityEscalationRuleRow = {
  id: string
  organization_id: string | null
  workflow_key: string
  rule_key: string
  condition_type: string
  condition_expression: Record<string, unknown>
  from_authority_level: string
  to_authority_level: string
  requires_human_confirmation: boolean
  system_blocking: boolean
  regulated: boolean
  audit_required: boolean
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export function mapWorkflowDecisionAuthorityRow(
  row: WorkflowDecisionAuthorityRow,
): WorkflowDecisionAuthority {
  if (!isWorkflowAuthorityLevel(row.base_authority_level)) {
    throw new Error(
      `Invalid base_authority_level "${row.base_authority_level}" for workflow "${row.workflow_key}"`,
    )
  }
  if (!isWorkflowKey(row.workflow_key)) {
    throw new Error(
      `Unknown workflow_key "${row.workflow_key}" — add to WORKFLOW_KEY constants before use`,
    )
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    workflowKey: row.workflow_key,
    category: row.category,
    baseAuthorityLevel: row.base_authority_level,
    aiAllowed: row.ai_allowed,
    humanConfirmationRequired: row.human_confirmation_required,
    systemBlocking: row.system_blocking,
    regulated: row.regulated,
    phiSensitive: row.phi_sensitive,
    auditRequired: row.audit_required,
    conditionalEscalationSupported: row.conditional_escalation_supported,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapWorkflowAuthorityEscalationRuleRow(
  row: WorkflowAuthorityEscalationRuleRow,
): WorkflowAuthorityEscalationRule {
  if (!isWorkflowAuthorityLevel(row.from_authority_level)) {
    throw new Error(
      `Invalid from_authority_level "${row.from_authority_level}" for rule "${row.rule_key}"`,
    )
  }
  if (!isWorkflowAuthorityLevel(row.to_authority_level)) {
    throw new Error(
      `Invalid to_authority_level "${row.to_authority_level}" for rule "${row.rule_key}"`,
    )
  }
  if (!isWorkflowEscalationConditionType(row.condition_type)) {
    throw new Error(
      `Invalid condition_type "${row.condition_type}" for rule "${row.rule_key}"`,
    )
  }
  if (!isWorkflowKey(row.workflow_key)) {
    throw new Error(`Unknown workflow_key "${row.workflow_key}" on rule "${row.rule_key}"`)
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    workflowKey: row.workflow_key,
    ruleKey: row.rule_key,
    conditionType: row.condition_type,
    conditionExpression: row.condition_expression ?? {},
    fromAuthorityLevel: row.from_authority_level,
    toAuthorityLevel: row.to_authority_level,
    requiresHumanConfirmation: row.requires_human_confirmation,
    systemBlocking: row.system_blocking,
    regulated: row.regulated,
    auditRequired: row.audit_required,
    active: row.active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
