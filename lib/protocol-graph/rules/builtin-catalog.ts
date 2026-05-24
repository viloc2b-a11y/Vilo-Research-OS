import type { ProtocolRuntimeRule } from '@/lib/protocol-graph/types'

/**
 * Built-in runtime rules (examples from architecture spec).
 * Studies opt in via study_versions.metadata.protocol_graph.ruleKeys.
 */
export const BUILTIN_PROTOCOL_GRAPH_RULES: Record<string, ProtocolRuntimeRule> = {
  cbc_abnormality_safety: {
    id: 'cbc_abnormality_safety',
    kind: 'safety_trigger',
    scope: 'visit',
    source: 'builtin',
    when: { op: 'lab_finding_for_procedure', procedureCode: 'CBC', params: { severity: 'error' } },
    then: [
      {
        type: 'trigger_safety_workflow',
        label: 'CBC abnormality safety review',
        detail: 'Critical CBC finding — coordinator safety workflow required.',
        severity: 'warning',
        workflowKey: 'safety_cbc_abnormality',
      },
      {
        type: 'escalate_monitoring',
        label: 'Escalated lab monitoring',
        detail: 'Repeat CBC and safety follow-up per protocol.',
        severity: 'warning',
      },
    ],
    metadata: { example: 'CBC abnormality → trigger safety workflow' },
  },
  unresolved_ae_signoff_block: {
    id: 'unresolved_ae_signoff_block',
    kind: 'signoff_blocker',
    scope: 'visit',
    source: 'builtin',
    when: { op: 'has_open_ae' },
    then: [
      {
        type: 'add_signoff_blocker',
        label: 'Unresolved adverse event',
        detail: 'Open AE on visit blocks coordinator/investigator signoff.',
        severity: 'blocker',
      },
      {
        type: 'block_visit_completion',
        label: 'Visit completion blocked by AE',
        detail: 'Resolve or document AE before visit closeout.',
        severity: 'blocker',
      },
    ],
    metadata: { example: 'unresolved AE → block signoff' },
  },
  unresolved_ae_subject_signoff: {
    id: 'unresolved_ae_subject_signoff',
    kind: 'signoff_blocker',
    scope: 'subject',
    source: 'builtin',
    when: { op: 'has_open_ae_subject' },
    then: [
      {
        type: 'add_signoff_blocker',
        label: 'Subject-level open AE',
        detail: 'Open AE on subject blocks signoff across active visits.',
        severity: 'blocker',
      },
    ],
  },
  pk_branch_activation: {
    id: 'pk_branch_activation',
    kind: 'conditional_branch',
    scope: 'subject',
    source: 'builtin',
    when: { op: 'branch_active', branchKey: 'pk_sampling' },
    then: [
      {
        type: 'activate_branch',
        label: 'PK sampling branch active',
        detail: 'PK visit requirements apply for this subject.',
        severity: 'info',
        branchKey: 'pk_sampling',
      },
      {
        type: 'require_conditional_procedure',
        label: 'PK draw required',
        procedureCode: 'PK_DRAW',
        severity: 'warning',
      },
    ],
    metadata: { example: 'PK branch activation' },
  },
  adrenal_monitoring_escalation: {
    id: 'adrenal_monitoring_escalation',
    kind: 'safety_trigger',
    scope: 'subject',
    source: 'builtin',
    when: {
      op: 'lab_finding_for_procedure',
      procedureCode: 'CORTISOL',
      params: { severity: 'error' },
    },
    then: [
      {
        type: 'escalate_monitoring',
        label: 'Adrenal monitoring escalation',
        detail: 'Abnormal cortisol — adrenal safety monitoring per protocol.',
        severity: 'warning',
        workflowKey: 'safety_adrenal_monitoring',
      },
    ],
    metadata: { example: 'adrenal monitoring escalation' },
  },
  off_site_modality_gate: {
    id: 'off_site_modality_gate',
    kind: 'off_site_eligibility',
    scope: 'visit',
    source: 'builtin',
    when: { op: 'visit_modality', modality: 'off_site' },
    then: [
      {
        type: 'add_visit_blocker',
        label: 'Off-site visit confirmation',
        detail: 'Confirm off-site eligibility and remote capture before check-in.',
        severity: 'warning',
      },
    ],
    metadata: { example: 'off-site execution rules' },
  },
  repeated_lab_dependency: {
    id: 'repeated_lab_dependency',
    kind: 'repeated_chain',
    scope: 'subject',
    source: 'builtin',
    when: {
      op: 'repeated_procedure_due',
      procedureCode: 'CBC',
      minRepeatCount: 1,
    },
    then: [
      {
        type: 'require_conditional_procedure',
        label: 'Repeat CBC due',
        procedureCode: 'CBC',
        detail: 'Prior CBC complete — repeat lab per longitudinal chain.',
        severity: 'warning',
      },
    ],
    metadata: { example: 'repeated lab dependencies' },
  },
  conditional_visit_window: {
    id: 'conditional_visit_window',
    kind: 'window_dependency',
    scope: 'visit',
    source: 'builtin',
    when: { op: 'visit_outside_window' },
    then: [
      {
        type: 'add_visit_blocker',
        label: 'Visit outside protocol window',
        detail: 'Scheduling outside window requires documented deviation.',
        severity: 'warning',
      },
    ],
    metadata: { example: 'conditional visit requirements / window deps' },
  },
}

export function resolveBuiltinRules(ruleKeys: string[]): ProtocolRuntimeRule[] {
  const rules: ProtocolRuntimeRule[] = []
  for (const key of ruleKeys) {
    const rule = BUILTIN_PROTOCOL_GRAPH_RULES[key.trim()]
    if (rule) rules.push(rule)
  }
  return rules
}
