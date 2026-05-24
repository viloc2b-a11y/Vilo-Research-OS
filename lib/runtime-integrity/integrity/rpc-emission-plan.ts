/**
 * Migration / RPC emission hardening plan (Phase 6 — documentation for DB work).
 */
export type RpcEmissionPlanItem = {
  rpcName: string
  migrationHint: string
  emitsOperationalEvent: boolean | 'partial'
  recommendedEventTypes: string[]
  priority: 'critical' | 'high' | 'medium'
  notes: string
}

export const RPC_EMISSION_HARDENING_PLAN: RpcEmissionPlanItem[] = [
  {
    rpcName: 'instantiate_conditional_procedure_execution',
    migrationHint: '0071_phase11d_protocol_generalization.sql',
    emitsOperationalEvent: true,
    recommendedEventTypes: ['CONDITIONAL_PROCEDURE_INSTANTIATED'],
    priority: 'high',
    notes: 'Verify payload envelope includes map_id and procedure_execution_id.',
  },
  {
    rpcName: 'publish_source_package',
    migrationHint: '0033_publish_source_package_rpc.sql',
    emitsOperationalEvent: 'partial',
    recommendedEventTypes: ['SOURCE_PACKAGE_PUBLISHED'],
    priority: 'high',
    notes: 'TS gateway also emits after RPC; avoid duplicate or ensure idempotent keys.',
  },
  {
    rpcName: 'open_source_response_set',
    migrationHint: 'source capture RPCs',
    emitsOperationalEvent: false,
    recommendedEventTypes: [],
    priority: 'critical',
    notes: 'Add optional operational_events row on open when clinically material.',
  },
  {
    rpcName: 'save_source_draft',
    migrationHint: 'source capture RPCs',
    emitsOperationalEvent: false,
    recommendedEventTypes: [],
    priority: 'medium',
    notes: 'Prefer aggregated telemetry for draft saves; full spine may be noisy.',
  },
  {
    rpcName: 'submit_source_response_set',
    migrationHint: '0067+ source RPCs',
    emitsOperationalEvent: true,
    recommendedEventTypes: ['SOURCE_RESPONSE_SET_SUBMITTED'],
    priority: 'critical',
    notes: 'Confirm unique index operational_events_source_submit_once_idx alignment.',
  },
  {
    rpcName: 'complete_visit / lock_visit (if present)',
    migrationHint: 'visit completion RPCs',
    emitsOperationalEvent: true,
    recommendedEventTypes: ['VISIT_COMPLETED', 'VISIT_LOCKED'],
    priority: 'critical',
    notes: 'Audit all terminal visit transitions for paired events.',
  },
  {
    rpcName: 'coordinator_sign_visit / investigator_sign_visit',
    migrationHint: 'closeout RPCs',
    emitsOperationalEvent: true,
    recommendedEventTypes: ['COORDINATOR_SIGNED', 'INVESTIGATOR_SIGNED'],
    priority: 'critical',
    notes: 'Must align with visit_review_status writes.',
  },
]

export const RPC_EMISSION_PRINCIPLES = [
  'Emit operational_events in the same transaction as the clinical mutation.',
  'Use standard payload envelope (schema_version, source, mutation, details).',
  'Prefer idempotent unique indexes for once-per-fact events.',
  'Register all RPC event_type values in OPERATIONAL_EVENT_TYPES.',
] as const
