import type { GovernanceDeviationRuleId, GovernanceSignalType } from '@/lib/governance-fabric/types'

export type DeviationRuleDefinition = {
  id: GovernanceDeviationRuleId
  signalType: GovernanceSignalType
  label: string
  description: string
  defaultSeverity: 'info' | 'warning' | 'blocker'
}

/**
 * Runtime-derived deviation detection v1 rule catalog.
 */
export const GOVERNANCE_DEVIATION_RULES_V1: DeviationRuleDefinition[] = [
  {
    id: 'visit_window_deviation',
    signalType: 'visit_window_deviation',
    label: 'Visit window deviation',
    description:
      'Visit scheduled or executed outside protocol window (window_status or target/window dates).',
    defaultSeverity: 'warning',
  },
  {
    id: 'missing_source_at_signoff',
    signalType: 'missing_source_at_signoff',
    label: 'Missing source at signoff',
    description: 'Procedure source capture not submitted when visit approaches coordinator signoff.',
    defaultSeverity: 'blocker',
  },
  {
    id: 'unresolved_finding_at_closeout',
    signalType: 'unresolved_finding_at_closeout',
    label: 'Unresolved finding at closeout',
    description: 'Critical open source validation finding blocks visit completion.',
    defaultSeverity: 'blocker',
  },
  {
    id: 'unresolved_ae_at_signoff',
    signalType: 'unresolved_ae_at_signoff',
    label: 'Unresolved AE at signoff',
    description: 'Open adverse event on subject or visit blocks signoff.',
    defaultSeverity: 'blocker',
  },
  {
    id: 'protocol_graph_blocker_unresolved',
    signalType: 'protocol_graph_blocker_unresolved',
    label: 'Protocol graph blocker',
    description: 'Published protocol graph reports unresolved orchestration blocker.',
    defaultSeverity: 'blocker',
  },
  {
    id: 'open_query_unresolved',
    signalType: 'open_query_unresolved',
    label: 'Open data query',
    description: 'Unresolved workflow query linked to visit or subject.',
    defaultSeverity: 'warning',
  },
  {
    id: 'safety_continuity_elevated',
    signalType: 'safety_continuity_elevated',
    label: 'Elevated safety continuity',
    description: 'Subject longitudinal safety continuity is elevated or critical.',
    defaultSeverity: 'warning',
  },
]

export function ruleById(id: GovernanceDeviationRuleId): DeviationRuleDefinition | undefined {
  return GOVERNANCE_DEVIATION_RULES_V1.find((r) => r.id === id)
}
