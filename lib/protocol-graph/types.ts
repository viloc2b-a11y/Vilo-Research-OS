/**
 * Phase 3 — Protocol Graph Engine entity model.
 * Graph orchestrates existing visit/procedure runtime; it does not replace execution tables.
 */

export const PROTOCOL_GRAPH_SCHEMA_VERSION = 1

export type ProtocolGraphNodeType =
  | 'study'
  | 'protocol_version'
  | 'visit_definition'
  | 'procedure_definition'
  | 'procedure_requirement'
  | 'eligibility_rule'
  | 'safety_rule'
  | 'dependency_rule'
  | 'branch'

export type ProtocolGraphEdgeType =
  | 'protocol_requires_visit'
  | 'visit_requires_procedure'
  | 'procedure_depends_on_procedure'
  | 'visit_depends_on_visit'
  | 'window_depends_on_visit'
  | 'result_triggers_workflow'
  | 'safety_event_blocks_visit'
  | 'lab_result_triggers_action'
  | 'branch_activates_visit'
  | 'procedure_requires_source'
  | 'amendment_changes_requirement'

export type ProtocolRuntimeRuleKind =
  | 'safety_trigger'
  | 'visit_blocker'
  | 'procedure_dependency'
  | 'conditional_branch'
  | 'window_dependency'
  | 'repeated_chain'
  | 'off_site_eligibility'
  | 'signoff_blocker'

export type ProtocolGraphNode = {
  nodeKey: string
  nodeType: ProtocolGraphNodeType
  entityRefType?: string | null
  entityRefId?: string | null
  properties: Record<string, unknown>
}

export type ProtocolGraphEdge = {
  edgeKey: string
  edgeType: ProtocolGraphEdgeType
  fromNodeKey: string
  toNodeKey: string
  condition: Record<string, unknown>
  properties: Record<string, unknown>
  sortOrder?: number
}

export type RuleConditionOp =
  | 'always'
  | 'has_open_ae'
  | 'has_open_ae_subject'
  | 'lab_finding_critical'
  | 'lab_finding_for_procedure'
  | 'procedure_incomplete'
  | 'procedure_unsigned'
  | 'branch_active'
  | 'visit_outside_window'
  | 'visit_modality'
  | 'prior_visit_incomplete'
  | 'repeated_procedure_due'

export type RuleCondition = {
  op: RuleConditionOp
  procedureCode?: string
  visitCode?: string
  branchKey?: string
  modality?: string
  minRepeatCount?: number
  params?: Record<string, unknown>
}

export type RuleActionType =
  | 'add_visit_blocker'
  | 'add_signoff_blocker'
  | 'trigger_safety_workflow'
  | 'require_conditional_procedure'
  | 'activate_branch'
  | 'block_visit_completion'
  | 'escalate_monitoring'

export type RuleAction = {
  type: RuleActionType
  label: string
  detail?: string
  severity?: 'blocker' | 'warning' | 'info'
  procedureCode?: string
  visitCode?: string
  branchKey?: string
  workflowKey?: string
}

export type ProtocolRuntimeRule = {
  id: string
  kind: ProtocolRuntimeRuleKind
  scope: 'visit' | 'subject' | 'study'
  when: RuleCondition
  then: RuleAction[]
  source: 'builtin' | 'study_metadata' | 'compiled'
  metadata?: Record<string, unknown>
}

export type ProtocolGraphAmendment = {
  supersedesPublicationId?: string | null
  supersedesGraphRevision?: number | null
  deltaSummary?: string | null
  changedNodeKeys?: string[]
  changedEdgeKeys?: string[]
}

export type ProtocolGraphDocument = {
  schemaVersion: number
  studyId: string
  organizationId: string
  studyVersionId: string | null
  studyVersionLabel: string | null
  compiledAt: string
  sourceChecksum: string
  amendment: ProtocolGraphAmendment
  nodes: ProtocolGraphNode[]
  edges: ProtocolGraphEdge[]
  runtimeRules: ProtocolRuntimeRule[]
}

export type GraphOrchestrationDirective = {
  ruleId: string
  kind: ProtocolRuntimeRuleKind
  action: RuleAction
  matched: boolean
}

export type GraphVisitBlocker = {
  id: string
  category: string
  severity: 'blocker' | 'warning' | 'info'
  label: string
  detail: string
  ruleId?: string
}

export type VisitGraphOrchestrationResult = {
  visitId: string
  studyId: string
  publicationId: string | null
  graphRevision: number | null
  blockers: GraphVisitBlocker[]
  directives: GraphOrchestrationDirective[]
  availableConditionalMapIds: string[]
  activeBranches: string[]
  snapshot: Record<string, unknown>
}

export type ProtocolGraphPublicationRow = {
  id: string
  organization_id: string
  study_id: string
  study_version_id: string | null
  graph_revision: number
  status: string
  graph_schema_version: number
  graph_document: ProtocolGraphDocument
  source_checksum: string | null
  supersedes_publication_id: string | null
  amendment_summary: Record<string, unknown>
  published_at: string | null
}

export type StudyGraphRuleExtensions = {
  ruleKeys?: string[]
  procedureDependencies?: Array<{
    visitCode: string
    procedureCode: string
    dependsOnProcedureCode: string
    required?: boolean
  }>
  visitDependencies?: Array<{
    visitCode: string
    dependsOnVisitCode: string
  }>
  branches?: Array<{
    branchKey: string
    arm?: string | null
    activatesVisitCodes?: string[]
    activatesProcedureCodes?: string[]
  }>
  repeatedChains?: Array<{
    anchorProcedureCode: string
    repeatProcedureCode: string
    minIntervalDays?: number
  }>
}
