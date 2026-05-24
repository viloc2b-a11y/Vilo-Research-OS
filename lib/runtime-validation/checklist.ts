/**
 * Runtime chain checklist — Phases 1C–10 pilot readiness.
 */
export const RUNTIME_CHAIN_CHECKLIST = [
  { goal: 1, id: 'events-on-mutation', label: 'Runtime actions emit operational_events' },
  { goal: 2, id: 'events-refresh-projections', label: 'Events / compute refresh derived projections' },
  { goal: 3, id: 'graph-blockers', label: 'Protocol graph blockers appear in readiness' },
  { goal: 4, id: 'safety-governance-carry', label: 'Safety/governance blockers carry forward' },
  { goal: 5, id: 'replay-explains-blocked', label: 'Replay explains blocked readiness' },
  { goal: 6, id: 'financial-leakage', label: 'Financial leakage derives correctly' },
  { goal: 7, id: 'coordinator-next-action', label: 'Coordinator next action appears' },
  { goal: 8, id: 'automation-propose-apply', label: 'Automation proposal can be applied (supervised)' },
  { goal: 9, id: 'ui-runtime-intelligence', label: 'UI model surfaces runtime intelligence' },
  { goal: 10, id: 'no-silent-mutation', label: 'No silent mutation breaks the chain' },
] as const

export const PILOT_SCENARIO_STEPS = [
  'Publish protocol graph',
  'Enroll subject',
  'Materialize schedule',
  'Check in visit',
  'Open / save / submit source',
  'Create unresolved finding or query',
  'Create AE',
  'Trigger blocked readiness',
  'Compute projections',
  'Generate replay',
  'Compute financial leakage',
  'Derive next action',
  'Propose automation',
  'Apply automation (coordinator)',
  'Verify UI model',
] as const
