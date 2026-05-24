/**
 * Phase 6 — Silent mutation enforcement strategy (documentation contract + CI hooks).
 */
export const SPINE_ENFORCEMENT_STRATEGY = {
  version: 6,
  principles: [
    'operational_events are the canonical runtime chronology',
    'clinical execution mutations must emit spine events or use RPCs that emit them',
    'projections and intelligence caches are derived and rebuildable',
    'static audit runs in CI; runtime report runs on-demand per scope',
  ],
  enforcementLayers: [
    {
      layer: 'static_audit',
      tool: 'scripts/runtime-integrity-audit.ts',
      action: 'Fail CI on unapproved clinical .from().update/insert/delete without emission proximity',
    },
    {
      layer: 'registry',
      tool: 'lib/runtime-integrity/event-registry/*',
      action: 'Normalize event_type drift; warn on unregistered types',
    },
    {
      layer: 'runtime_report',
      tool: 'buildRuntimeIntegrityReport',
      action: 'Per visit/subject/study: projection freshness, replay gaps, drift',
    },
    {
      layer: 'gateway',
      tool: 'ClinicalMutationGateway',
      action: 'Preferred TS emission path with standard payload envelope',
    },
    {
      layer: 'database_rpc',
      tool: 'Postgres RPCs (see rpc-emission-plan)',
      action: 'Co-locate mutation + operational_events insert in same transaction',
    },
  ],
  notInScopePhase6: [
    'dashboards',
    'financial runtime',
    'AI copilots',
    'blocking runtime at DB layer for all tables (audit-first)',
  ],
} as const
